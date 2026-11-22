/* =========================================================
 * 《土楼争霸》双人对决模式
 * 本机或局域网：红方（左）vs 金方（右）
 * - 在自己半场放木偶防守
 * - 花福币往对面派兵，兵沿三条路之一走向对方土楼
 * - 先打爆对方土楼获胜；时间到比血量，平局加时
 * 依赖 game.js 暴露的 window.TULOU_CORE
 * ========================================================= */
(function () {
  'use strict';

  const C = window.TULOU_CORE;
  const D = window.GAME_DATA;
  const V = D.versus;
  const { W, H, ctx, canvas, getImg, dist2, clamp } = C;
  const $ = (id) => document.getElementById(id);
  const OTHER = { L: 'R', R: 'L' };
  const juice = window.JUICE;
  const HERO_KEYS = Object.keys(D.heroes);
  const UNIT_KEYS = Object.keys(V.units);
  const SNAPSHOT_MS = 50;

  let S = null;          // 对战状态
  let netRole = null, netPaused = false, snapshotTimer = 0, resultTimer = 0;
  let pointerAt = -Infinity;
  let interpolation = null;
  const pendingEffects = [];
  const VS = { active: false };
  window.VS = VS;

  // 本机直接播放，联机主机还将同一调用存入下一份快照。
  const replicable = ['shake', 'hitstop', 'sparks', 'dust', 'ring', 'number', 'glyphs', 'confetti', 'sparkleUp'];
  const J = { ...juice };
  for (const name of replicable) {
    J[name] = (...args) => { juice[name](...args); emitEffect(name, ...args); };
  }
  const Sound = {
    play(name) { C.Sound.play(name); emitEffect('sound', name); }
  };
  function emitEffect(name, ...args) {
    if (netRole === 'L' && pendingEffects.length < 512) pendingEffects.push([name, ...args]);
  }
  function replayEffects(events) {
    if (!Array.isArray(events)) return;
    for (const event of events.slice(0, 512)) {
      if (!Array.isArray(event)) continue;
      const [name, ...args] = event;
      if (name === 'sound' && juice.SFX_NAMES.includes(args[0])) C.Sound.play(args[0]);
      else if (name === 'coins' && (args[3] === 'L' || args[3] === 'R')) rewardCoins(...args);
      else if (name === 'comment' && Object.hasOwn(D.commentary, args[0])) C.announce(...args);
      else if (replicable.includes(name)) juice[name](...args);
    }
  }

  /* ---------------- 路线 ---------------- */
  function buildLane(pts) {
    const segs = []; let total = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      const [x1, y1] = pts[i], [x2, y2] = pts[i + 1];
      const len = Math.hypot(x2 - x1, y2 - y1);
      segs.push({ x1, y1, x2, y2, len, start: total });
      total += len;
    }
    return { pts, segs, total };
  }
  function lanePos(lane, d) {
    for (const s of lane.segs) {
      if (d <= s.start + s.len) {
        const t = Math.max(0, d - s.start) / s.len;
        return [s.x1 + (s.x2 - s.x1) * t, s.y1 + (s.y2 - s.y1) * t];
      }
    }
    const l = lane.segs[lane.segs.length - 1];
    return [l.x2, l.y2];
  }
  // 红方的兵正向走，金方的兵反向走
  const unitPos = (u) => lanePos(S.lanes[u.lane], u.owner === 'L' ? u.d : S.lanes[u.lane].total - u.d);

  /* ---------------- 开局 ---------------- */
  function makePlayer(side) {
    const slots = side === 'L' ? V.slotsL : V.slotsR;
    const [tx, ty] = side === 'L' ? V.tulouL : V.tulouR;
    return {
      side, team: V.teams[side],
      fu: V.startFu, hp: V.towerHP, maxHp: V.towerHP, fuqi: 0,
      selected: HERO_KEYS[0], lane: 1, cursor: 0,
      tulou: { x: tx, y: ty },
      towers: slots.map(([x, y]) => ({ x, y, side, hero: null, level: 0, cd: 0, anim: 0, damage: 0 })),
      stats: { sent: 0, kills: 0, ults: 0, dmg: 0 },
      lowSaid: false, recentKills: [], bigStreak: 0, chouPlaced: false
    };
  }

  function initialState() {
    return {
      lanes: V.lanes.map(buildLane),
      P: { L: makePlayer('L'), R: makePlayer('R') },
      units: [], projectiles: [], effects: [], texts: [],
      time: 0, clock: V.duration, overtime: false, finalSaid: false, nextId: 1,
      phase: 'countdown', countdown: 3.6,
      incomeT: 0, ultFlash: null, over: false, paused: false, lastComment: -99
    };
  }

  function start(role, savedState) {
    VS.stop();
    netRole = role;
    C.showScreen(null);
    S = restoreSnapshot(savedState) || initialState();
    J.clear();
    C.clearCommentary();
    for (const key of Object.keys(cache)) delete cache[key];
    const hud = $('vs-ui');
    hud.classList.remove('hidden');
    if (role) hud.dataset.netRole = role;
    $('vs-net-role').classList.toggle('hidden', !role);
    $('vs-net-role').textContent = role === 'watch' ? '观战中' : role ? '你是 ' + V.teams[role].name : '';
    $('vs-net-exit').classList.toggle('hidden', !role);
    $('vs-pause').classList.toggle('hidden', Boolean(role));
    for (const side of ['L', 'R']) {
      buildPanel(side);
      $('vs-panel' + side).classList.toggle('hidden', Boolean(role && role !== side));
    }
    $('vs-again').classList.toggle('hidden', role === 'watch');
    $('vs-again').disabled = false;
    $('vs-again').textContent = '再来一局';
    VS.active = true;
    if (S.over) showResult();
    else if (!savedState && (!role || role === 'L')) Sound.play('wave');
    if (role === 'L' && !S.over) beginPublishing();
  }

  VS.open = () => window.NET ? window.NET.open() : VS.start();
  VS.start = () => start(null);
  VS.startNet = (role, state) => start(role, state);
  VS.stop = function () {
    clearInterval(snapshotTimer);
    clearTimeout(resultTimer);
    snapshotTimer = resultTimer = 0;
    netRole = null;
    netPaused = false;
    interpolation = null;
    pointerAt = -Infinity;
    pendingEffects.length = 0;
    VS.active = false;
    S = null;
    delete $('vs-ui').dataset.netRole;
    $('vs-ui').classList.add('hidden');
  };
  VS.resume = function () { if (S && !netRole) S.paused = false; };
  Object.defineProperty(VS, 'S', { get: () => S });   // 调试用
  Object.defineProperty(VS, 'netRole', { get: () => netRole });

  /* ---------------- 局域网快照 ---------------- */
  function makeSnapshot() {
    const { lanes, units, projectiles, ...match } = S;
    return {
      ...match,
      units: units.map(({ t, ...unit }) => unit),
      projectiles: projectiles.map(({ h, target, tower, ...shot }) => ({
        ...shot, hero: tower.hero, targetId: target?.id ?? null,
        towerIndex: S.P[shot.side].towers.indexOf(tower)
      }))
    };
  }

  function restoreSnapshot(state) {
    if (!state?.P?.L || !state.P.R || !Array.isArray(state.units) || !Array.isArray(state.projectiles)) return null;
    const units = state.units.map((u) => ({ ...u, t: D.enemies[u.type] }));
    const byId = new Map(units.map((u) => [u.id, u]));
    const projectiles = state.projectiles.map((p) => ({
      ...p, h: D.heroes[p.hero], target: byId.get(p.targetId),
      tower: state.P[p.side].towers[p.towerIndex]
    }));
    return { ...state, units, projectiles, lanes: S?.lanes || V.lanes.map(buildLane), paused: netPaused };
  }

  function publish() {
    if (!S || netRole !== 'L' || !window.NET?.snapshot(makeSnapshot(), pendingEffects)) return false;
    pendingEffects.length = 0;
    return true;
  }

  function beginPublishing() {
    let last = performance.now();
    publish();
    snapshotTimer = setInterval(() => {
      const now = performance.now();
      // 浏览器把后台标签页的绘制停下来时，主机继续推进比赛。
      if (document.hidden && S && !S.paused && !S.over) {
        let elapsed = Math.min((now - last) / 1000, 1);
        while (elapsed > 0 && !S.over) {
          const step = Math.min(elapsed, 1 / 60);
          update(juice.tick(step));
          elapsed -= step;
        }
      }
      last = now;
      if (publish() && S.over) clearInterval(snapshotTimer);
    }, SNAPSHOT_MS);
  }

  VS.receiveSnapshot = function (state, events) {
    if (!netRole || netRole === 'L' || !S) return;
    const next = restoreSnapshot(state);
    if (!next || S.over) return;
    interpolation = {
      at: performance.now(),
      units: new Map(S.units.map((item) => [item.id, item])),
      shots: new Map(S.projectiles.map((item) => [item.id, item]))
    };
    S = next;
    replayEffects(events);
    if (S.over) scheduleResult();
  };

  VS.setNetPaused = function (paused) {
    if (!netRole || !S || S.over) return;
    netPaused = S.paused = Boolean(paused);
  };
  VS.netForfeit = function (winner) {
    if (netRole && S && Object.hasOwn(V.teams, winner)) {
      netPaused = S.paused = false;
      endMatch(winner);
    }
  };

  /* ---------------- 解说 ---------------- */
  function comment(kind, side, force, values) {
    if (!S) return;
    if (!force && S.time - S.lastComment < 3) return;
    const context = { team: side ? V.teams[side].name : '', ...values };
    emitEffect('comment', kind, context);
    if (C.announce(kind, context) || netRole === 'L') S.lastComment = S.time;
  }

  /* ---------------- 玩家操作 ---------------- */
  function selectHero(side, key) {
    if (!S || !D.heroes[key]) return;
    S.P[side].selected = key;
    Sound.play('click');
  }
  function moveCursor(side, dir) {
    const p = S.P[side], n = p.towers.length;
    p.cursor = (p.cursor + dir + n) % n;
  }
  function changeLane(side, dir) {
    const p = S.P[side], n = S.lanes.length;
    p.lane = (p.lane + dir + n) % n;
    Sound.play('click');
  }

  const oneOf = (args, keys) => args.length === 1 && keys.includes(args[0]);
  function applyInput(side, action, args) {
    if (!S || S.over || S.paused || !Array.isArray(args)) return;
    const p = S.P[side];
    if (action === 'pointer') {
      if (!args.length) p.pointer = null;
      else if (args.length === 2 && args.every(Number.isFinite) &&
        args[0] >= 0 && args[0] <= W && args[1] >= 0 && args[1] <= H) p.pointer = args;
      return;
    }
    if (action === 'selectHero' && oneOf(args, HERO_KEYS)) selectHero(side, args[0]);
    if (action === 'moveCursor' && oneOf(args, [-1, 1])) moveCursor(side, args[0]);
    if (action === 'changeLane' && oneOf(args, [-1, 1])) changeLane(side, args[0]);
    if (action === 'sendUnit' && oneOf(args, UNIT_KEYS)) sendUnit(side, args[0]);
    if (action === 'useUlt' && !args.length) useUlt(side);
    if (action === 'placeOrUpgrade') {
      const idx = args.length ? args[0] : p.cursor;
      if (args.length <= 1 && Number.isInteger(idx) && idx >= 0 && idx < p.towers.length) placeOrUpgrade(side, idx);
    }
  }

  function playerInput(side, action, ...args) {
    if (!S || S.over || S.paused || (netRole && netRole !== side)) return;
    if (netRole === 'R') window.NET?.input(action, ...args);
    else applyInput(side, action, args);
  }

  VS.receiveInput = (side, action, args) => {
    if (netRole === 'L' && side === 'R') applyInput(side, action, args);
  };

  function placeOrUpgrade(side, idx) {
    if (!S || S.phase !== 'fight' || S.over) return;
    const p = S.P[side], tw = p.towers[idx];
    p.cursor = idx;
    if (!tw.hero) {
      const h = D.heroes[p.selected];
      if (p.fu < h.cost) { floatText(tw.x, tw.y - 30, '福币不够', '#ffb0b0'); return; }
      p.fu -= h.cost;
      tw.hero = p.selected; tw.level = 1; tw.cd = 0.35; tw.spawnT = 0.3;
      const match = S;
      setTimeout(() => {
        if (S !== match || match.over) return;
        J.dust(tw.x, tw.y + 18, 9);
        J.ring(tw.x, tw.y + 14, 40, '#fff3c4', 0.3, 4);
        J.shake(2, 0.1);
      }, 280);
      S.effects.push({ type: 'ring', x: tw.x, y: tw.y, t: 0, max: 0.4, color: p.team.color, r: 30 });
      Sound.play('place');
      if (tw.hero === 'chou' && !p.chouPlaced) {
        p.chouPlaced = true;
        comment('firstChou', side, true);
      }
      return;
    }
    if (tw.level >= D.upgrade.maxLevel) { floatText(tw.x, tw.y - 30, '已满级', '#fff'); return; }
    const cost = Math.round(D.heroes[tw.hero].cost * D.upgrade.costRate * tw.level);
    if (p.fu < cost) { floatText(tw.x, tw.y - 30, `升级要${cost}`, '#ffb0b0'); return; }
    p.fu -= cost; tw.level++;
    tw.anim = 0.18;
    J.sparkleUp(tw.x, tw.y, 16);
    J.ring(tw.x, tw.y, 46, '#ffd34d', 0.4, 5);
    floatText(tw.x, tw.y - 40, '升级!', '#fff');
    S.effects.push({ type: 'ring', x: tw.x, y: tw.y, t: 0, max: 0.5, color: '#fff', r: 34 });
    Sound.play('upgrade');
  }

  function sendUnit(side, type) {
    if (!S || S.phase !== 'fight' || S.over) return;
    const p = S.P[side], cost = V.units[type].cost;
    if (p.fu < cost) return;
    p.fu -= cost;
    const t = D.enemies[type];
    const hp = t.hp * V.unitHpScale * (1 + Math.min(S.time, 240) / 240);   // 越往后兵越硬
    const u = { id: S.nextId++, owner: side, type, t, lane: p.lane, d: 0, hp, maxHp: hp, x: 0, y: 0,
      slowT: 0, slowF: 1, stunT: 0, dead: false, faceLeft: side === 'R', wob: Math.random() * 6 };
    [u.x, u.y] = unitPos(u);
    S.units.push(u);
    p.stats.sent++;
    Sound.play('throw');
    p.bigStreak = type === 'big' ? p.bigStreak + 1 : 0;
    if (p.bigStreak === D.narration.bigSendCount) comment('vsBigStreak', side, true);
    else if (type === 'big') comment('vsSendBig', side);
  }

  function useUlt(side) {
    if (!S || S.phase !== 'fight' || S.over) return;
    const p = S.P[side];
    if (p.fuqi < D.ult.need) return;
    p.fuqi = 0; p.stats.ults++;
    // 只对自己半场里的敌方小兵生效
    for (const u of S.units) {
      if (u.dead || u.owner === side) continue;
      const inHalf = side === 'L' ? u.x < W / 2 : u.x > W / 2;
      if (!inHalf) continue;
      u.stunT = D.ult.stun;
      J.sparks(u.x, u.y, 4, ['#ffd34d', '#fff'], 200);
      damage(u, D.ult.dmg, side, 'ult');
    }
    S.ultFlash = { side, t: 1.2 };
    J.hitstop(0.16); J.shake(12, 0.5);
    const cx = side === 'L' ? W / 4 : W * 3 / 4;
    J.glyphs(cx, H / 2, 10, '福', '#ffd34d');
    J.confetti(cx, H / 2, 34, ['#c8102e', '#ffd34d', '#e8392f'], 400);
    comment('vsUlt', side, true);
    Sound.play('ult');
  }

  /* ---------------- 伤害 ---------------- */
  const NUM_COLOR = { melee: '#ffffff', slow: '#cfe8ff', aoe: '#ffd34d', ult: '#ffe28a' };
  function damage(u, amount, by, kind, tower) {
    if (u.dead) return;
    const hpBefore = u.hp;
    u.hp -= amount;
    if (C.recordTowerHit(tower, hpBefore, u.hp, S.time)) {
      comment('towerStreak', by, true, { hero: D.heroes[tower.hero].name });
    }
    u.flash = 0.09; u.squash = 0.14;
    if (kind === 'melee') u.d = Math.max(0, u.d - 8);
    else if (kind === 'slow') u.d = Math.max(0, u.d - 3);
    J.number(u.x, u.y - u.t.r - 16, amount, NUM_COLOR[kind] || '#fff', kind === 'melee' || kind === 'ult' || amount >= 30);
    if (u.hp <= 0) {
      u.dead = true;
      const p = S.P[by];
      p.fu += u.t.reward;
      p.fuqi = Math.min(D.ult.need, p.fuqi + 1);
      p.stats.kills++;
      p.recentKills.push(S.time);
      floatText(u.x, u.y - 18, '+' + u.t.reward, p.team.color === '#d4a017' ? '#ffe28a' : '#ff9aa8');
      S.effects.push({ type: 'poof', x: u.x, y: u.y, t: 0, max: 0.4, color: u.t.color });
      const big = u.type === 'big';
      J.sparks(u.x, u.y, big ? 16 : 8, ['#fff3c4', '#ffd34d', u.t.color], big ? 340 : 230);
      J.dust(u.x, u.y + u.t.r * 0.6, big ? 9 : 4);
      J.ring(u.x, u.y, big ? 70 : 40, '#fff', 0.3, big ? 6 : 4);
      rewardCoins(u.x, u.y, big ? 4 : 2, by);
      if (big) { J.shake(6, 0.25); J.hitstop(0.06); Sound.play('bigkill'); } else Sound.play('kill');
    }
  }
  function rewardCoins(x, y, count, side) {
    const [fx, fy] = fuTarget(side);
    J.coins(x, y, count, fx, fy, () => bumpFu(side));
    emitEffect('coins', x, y, count, side);
  }
  function fuTarget(side) {
    const panel = $('vs-panel' + side);
    if (panel.classList.contains('hidden')) return [S.P[side].tulou.x, 60];
    try {
      const el = panel.querySelector('[data-k="fu"]');
      const r = el.getBoundingClientRect(), c = canvas.getBoundingClientRect();
      return [(r.left + r.width / 2 - c.left) / c.width * W, (r.top + r.height / 2 - c.top) / c.height * H];
    } catch (e) { return side === 'L' ? [40, 515] : [920, 515]; }
  }
  function bumpFu(side) {
    const el = $('vs-panel' + side).querySelector('.vp-fu');
    if (!el) return;
    el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump');
  }
  function floatText(x, y, text, color) { S.texts.push({ x, y, text, color, t: 0, max: 0.9 }); }

  /* ---------------- 更新 ---------------- */
  function update(dt) {
    if (!S || S.over || S.paused) return;
    S.time += dt;

    if (S.phase === 'countdown') {
      const before = Math.ceil(S.countdown);
      S.countdown -= dt;
      if (Math.ceil(S.countdown) !== before && S.countdown > 0) Sound.play('click');
      if (S.countdown <= 0) { S.phase = 'fight'; comment('vsStart', null, true); Sound.play('wave'); J.shake(5, 0.3); }
      return;
    }

    // 计时
    S.clock -= dt;
    if (S.clock <= 0) { timeUp(); if (S.over) return; }
    if (!S.finalSaid && S.clock <= D.narration.finalSeconds) {
      S.finalSaid = true;
      comment('vsFinalSeconds', null, true);
    }

    // 自动收入
    S.incomeT += dt;
    if (S.incomeT >= V.incomeEvery) {
      S.incomeT -= V.incomeEvery;
      S.P.L.fu += V.income; S.P.R.fu += V.income;
    }

    // 小兵移动
    for (const u of S.units) {
      if (u.dead) continue;
      if (u.flash > 0) u.flash -= dt;
      if (u.squash > 0) u.squash -= dt;
      if (u.stunT > 0) u.stunT -= dt;
      else u.d += u.t.speed * (u.slowT > 0 ? u.slowF : 1) * dt;
      if (u.slowT > 0) u.slowT -= dt;
      const px = u.x;
      [u.x, u.y] = unitPos(u);
      if (Math.abs(u.x - px) > 0.01) u.faceLeft = u.x < px;
      if (u.d >= S.lanes[u.lane].total) {
        u.dead = true;
        const target = S.P[OTHER[u.owner]];
        const attacker = S.P[u.owner];
        const wasTied = target.hp === attacker.hp;
        target.hp = Math.max(0, target.hp - u.t.dmg);
        attacker.stats.dmg += u.t.dmg;
        S.effects.push({ type: 'ring', x: target.tulou.x, y: target.tulou.y, t: 0, max: 0.5, color: '#ff4040', r: 60 });
        floatText(target.tulou.x, target.tulou.y - 60, '-' + u.t.dmg, '#ff6060');
        Sound.play('leak');
        J.shake(8, 0.28); J.dust(target.tulou.x, target.tulou.y + 30, 10, '#c9a36b');
        target.hitT = 0.3;
        if (target.hp <= 0) { endMatch(u.owner); return; }
        if (!target.lowSaid && target.hp <= target.maxHp * D.narration.lowHpRatio) { target.lowSaid = true; comment('vsLow', target.side, true); }
        if (!wasTied && target.hp === attacker.hp) comment('vsTied', null, true);
      }
    }

    // 木偶攻击：只打对方的兵
    for (const side of ['L', 'R']) {
      for (const tw of S.P[side].towers) {
        if (!tw.hero) continue;
        tw.anim = Math.max(0, tw.anim - dt);
        tw.lunge = Math.max(0, (tw.lunge || 0) - dt);
        tw.spawnT = Math.max(0, (tw.spawnT || 0) - dt);
        tw.cd -= dt;
        if (tw.cd > 0) continue;
        const h = D.heroes[tw.hero], lv = tw.level - 1, U = D.upgrade;
        const dmg = h.dmg * (1 + U.dmgPerLevel * lv);
        const range = h.range * (1 + U.rangePerLevel * lv);
        let target = null;
        for (const u of S.units) {
          if (u.dead || u.owner === side) continue;
          if (dist2(tw.x, tw.y, u.x, u.y) <= range * range && (!target || u.d > target.d)) target = u;
        }
        if (!target) continue;
        tw.cd = h.rate * (1 - 0.08 * lv);
        tw.anim = 0.18;
        const ddx = target.x - tw.x, ddy = target.y - tw.y, dd = Math.hypot(ddx, ddy) || 1;
        if (h.melee) {
          tw.lx = ddx / dd; tw.ly = ddy / dd; tw.lunge = 0.15;
          damage(target, dmg, side, 'melee', tw);
          S.effects.push({ type: 'slash', x: target.x, y: target.y, t: 0, max: 0.2 });
          J.sparks(target.x, target.y - 6, 7, ['#ffffff', '#ffd34d', '#ff9a3c'], 280);
          J.shake(1.4, 0.08);
          Sound.play('hit');
        } else {
          tw.lx = -ddx / dd * 0.5; tw.ly = -ddy / dd * 0.5; tw.lunge = 0.12;
          S.projectiles.push({ id: S.nextId++, x: tw.x, y: tw.y - 10, tx: target.x, ty: target.y, target, side, h, dmg, tower: tw, level: tw.level,
            speed: h.type === 'aoe' ? 360 : 480, done: false });
          Sound.play(h.type === 'aoe' ? 'throw' : 'fan');
        }
      }
    }

    // 飞行道具
    for (const p of S.projectiles) {
      if (p.target && !p.target.dead) { p.tx = p.target.x; p.ty = p.target.y; }
      const dx = p.tx - p.x, dy = p.ty - p.y, d = Math.hypot(dx, dy), step = p.speed * dt;
      if (d > step) { p.x += dx / d * step; p.y += dy / d * step; continue; }
      p.x = p.tx; p.y = p.ty; p.done = true;
      if (p.h.type === 'aoe') {
        const r = p.h.splash * (1 + 0.1 * (p.level - 1));
        for (const u of S.units) if (!u.dead && u.owner !== p.side && dist2(p.x, p.y, u.x, u.y) <= r * r) damage(u, p.dmg, p.side, 'aoe', p.tower);
        S.effects.push({ type: 'boom', x: p.x, y: p.y, t: 0, max: 0.35, r });
        J.sparks(p.x, p.y, 14, ['#ffd34d', '#ff6a00', '#ffffff'], 320);
        J.confetti(p.x, p.y, 16, ['#c8102e', '#e8392f', '#ffd34d', '#b30000']);
        J.ring(p.x, p.y, r * 1.15, '#ffb347', 0.3, 5);
        J.shake(3, 0.12);
        Sound.play('boom');
      } else if (p.target && !p.target.dead) {
        damage(p.target, p.dmg, p.side, 'slow', p.tower);
        J.sparks(p.x, p.y, 5, ['#e6f4ff', '#9fd3ff'], 170);
        if (p.h.type === 'slow') { p.target.slowT = p.h.slowTime; p.target.slowF = p.h.slow; }
      }
    }

    // 连杀解说
    for (const side of ['L', 'R']) {
      const pl = S.P[side];
      pl.recentKills = pl.recentKills.filter((t) => S.time - t < 1.5);
      if (pl.recentKills.length >= 4) { comment('vsKills', side); pl.recentKills = []; }
    }

    // 清理
    S.units = S.units.filter((u) => !u.dead);
    S.projectiles = S.projectiles.filter((p) => !p.done);
    for (const fx of S.effects) fx.t += dt;
    S.effects = S.effects.filter((fx) => fx.t < fx.max);
    for (const tx of S.texts) { tx.t += dt; tx.y -= 30 * dt; }
    S.texts = S.texts.filter((tx) => tx.t < tx.max);
    if (S.ultFlash && (S.ultFlash.t -= dt) <= 0) S.ultFlash = null;
    for (const sd of ['L', 'R']) if (S.P[sd].hitT > 0) S.P[sd].hitT -= dt;
  }

  function timeUp() {
    const { L, R } = S.P;
    if (L.hp !== R.hp) { endMatch(L.hp > R.hp ? 'L' : 'R'); return; }
    if (!S.overtime) {
      S.overtime = true; S.clock = V.overtime;
      S.finalSaid = false;
      comment('vsOvertime', null, true);
      Sound.play('wave');
      return;
    }
    endMatch(null);
  }

  function endMatch(winner) {
    if (S.over) return;
    S.over = true; S.winner = winner;
    if (winner) comment('vsWin', winner, true); else comment('vsDraw', null, true);
    const wx = winner === 'R' ? W * 3 / 4 : winner === 'L' ? W / 4 : W / 2;
    for (let i = 0; i < 4; i++) J.confetti(wx - 150 + i * 100, 60, 22, ['#c8102e', '#ffd34d', '#e8392f', '#fff3c4'], 300);
    if (winner) J.glyphs(S.P[winner].tulou.x, S.P[winner].tulou.y, 8, '福', '#ffd34d');
    if (winner) { const loser = S.P[OTHER[winner]]; J.shake(10, 0.5); loser.hitT = 0.6; }
    Sound.play('win');
    if (netRole === 'L' && publish()) clearInterval(snapshotTimer);
    scheduleResult();
  }

  function scheduleResult() {
    if (resultTimer) return;
    resultTimer = setTimeout(() => {
      resultTimer = 0;
      if (S?.over) showResult();
    }, 1600);
  }

  function showResult() {
    const { L, R } = S.P;
    $('vs-result-title').textContent = S.winner ? `${V.teams[S.winner].name}获胜！` : '平局！';
    $('vs-result-title').style.color = S.winner ? V.teams[S.winner].color : '';
    const table = $('vs-result-table');
    table.replaceChildren();
    const rows = [
      ['', V.teams.L.name, V.teams.R.name],
      ['土楼剩余', L.hp, R.hp],
      ['派兵数', L.stats.sent, R.stats.sent],
      ['击败敌兵', L.stats.kills, R.stats.kills],
      ['大招次数', L.stats.ults, R.stats.ults],
      ['对土楼伤害', L.stats.dmg, R.stats.dmg]
    ];
    for (const [label, left, right] of rows) {
      const row = table.insertRow();
      const title = document.createElement('th');
      title.textContent = label;
      const a = row.insertCell();
      a.className = label ? 'l' : 'l team L';
      a.textContent = left;
      row.append(title);
      const b = row.insertCell();
      b.className = label ? 'r' : 'r team R';
      b.textContent = right;
    }
    $('vs-ui').classList.add('hidden');
    C.showScreen('vsresult');
  }
  $('vs-again').addEventListener('click', () => {
    if (!netRole) VS.start();
    else if (netRole !== 'watch') window.NET?.again();
  });
  $('vs-pause').addEventListener('click', () => {
    if (!S || S.over || netRole) return;
    S.paused = true;
    C.showScreen('pause');
  });

  /* =========================================================
   * 面板（左右各一套，鼠标 / 触屏都能点）
   * ========================================================= */
  const KEY_HINT = {
    L: '键盘：1/2/3 选木偶 · A/D 选空位 · 空格 放置/升级 · Q/E/R 派兵 · W/S 换路 · F 大招',
    R: '键盘：7/8/9 选木偶 · ←/→ 选空位 · Enter 放置/升级 · I/O/P 派兵 · ↑/↓ 换路 · L 大招'
  };
  function buildPanel(side) {
    const el = $('vs-panel' + side);
    const heroBtns = HERO_KEYS.map((k) => {
      const h = D.heroes[k], img = getImg(h.img);
      return `<button class="vp-hero" data-hero="${k}" title="${h.desc}">` +
        `<span class="face" style="${img ? `background-image:url(assets/images/${h.img})` : `background-color:${h.color}`}">${img ? '' : h.short}</span>` +
        `<span class="c">${h.cost}</span></button>`;
    }).join('');
    const sendBtns = UNIT_KEYS.map((k) => {
      const t = D.enemies[k], img = getImg(t.img);
      return `<button class="vp-send" data-unit="${k}" title="派出${t.name}">` +
        `<span class="face" style="${img ? `background-image:url(assets/images/${t.img})` : `background-color:${t.color}`}"></span>` +
        `<span class="c">${V.units[k].cost}</span></button>`;
    }).join('');
    el.innerHTML =
      `<div class="vp-info"><span class="vp-fu"><i class="ico-fu">福</i><b data-k="fu">0</b></span>` +
      `<button class="vp-lane" data-k="lane">中路 ⇅</button></div>` +
      `<div class="vp-row"><span class="vp-lbl">布阵</span>${heroBtns}</div>` +
      `<div class="vp-row"><span class="vp-lbl">派兵</span>${sendBtns}</div>` +
      `<button class="vp-ult" data-k="ult"><span>五福临门</span><span class="ult-bar"><span data-k="ultfill"></span></span></button>`;
    el.title = netRole ? KEY_HINT.L : KEY_HINT[side];
    el.querySelectorAll('.vp-hero').forEach((b) => b.addEventListener('click', () => playerInput(side, 'selectHero', b.dataset.hero)));
    el.querySelectorAll('.vp-send').forEach((b) => b.addEventListener('click', () => playerInput(side, 'sendUnit', b.dataset.unit)));
    el.querySelector('[data-k="lane"]').addEventListener('click', () => playerInput(side, 'changeLane', 1));
    el.querySelector('[data-k="ult"]').addEventListener('click', () => playerInput(side, 'useUlt'));
  }

  const cache = {};
  function setText(el, key, v) { if (cache[key] !== v) { cache[key] = v; el.textContent = v; } }
  function updateUi() {
    for (const side of ['L', 'R']) {
      const p = S.P[side], el = $('vs-panel' + side);
      setText(el.querySelector('[data-k="fu"]'), side + 'fu', String(p.fu));
      setText(el.querySelector('[data-k="lane"]'), side + 'lane', V.laneNames[p.lane] + ' ⇅');
      el.querySelectorAll('.vp-hero').forEach((b) => {
        b.classList.toggle('sel', p.selected === b.dataset.hero);
        b.classList.toggle('poor', p.fu < D.heroes[b.dataset.hero].cost);
      });
      el.querySelectorAll('.vp-send').forEach((b) => b.classList.toggle('poor', p.fu < V.units[b.dataset.unit].cost));
      const ready = p.fuqi >= D.ult.need && S.phase === 'fight' && !S.over && !S.paused;
      const ub = el.querySelector('[data-k="ult"]');
      ub.disabled = !ready; ub.classList.toggle('ready', ready);
      el.querySelector('[data-k="ultfill"]').style.width = (p.fuqi / D.ult.need * 100) + '%';
      $('vs-hp' + side).style.width = (p.hp / p.maxHp * 100) + '%';
      setText($('vs-hp' + side + 't'), side + 'hp', String(p.hp));
    }
    const sec = Math.max(0, Math.ceil(S.phase === 'countdown' ? V.duration : S.clock));
    const txt = (S.overtime ? '加时 ' : '') + Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0');
    setText($('vs-clock'), 'clock', txt);
    $('vs-clock').classList.toggle('urgent', S.phase === 'fight' && S.clock <= D.narration.finalSeconds);
  }

  /* ---------------- 键盘 ---------------- */
  const primaryKeys = {
    Digit1: ['selectHero', HERO_KEYS[0]], Digit2: ['selectHero', HERO_KEYS[1]], Digit3: ['selectHero', HERO_KEYS[2]],
    KeyA: ['moveCursor', -1], KeyD: ['moveCursor', 1], Space: ['placeOrUpgrade'],
    KeyQ: ['sendUnit', UNIT_KEYS[0]], KeyE: ['sendUnit', UNIT_KEYS[1]], KeyR: ['sendUnit', UNIT_KEYS[2]],
    KeyW: ['changeLane', -1], KeyS: ['changeLane', 1], KeyF: ['useUlt']
  };
  const secondaryKeys = {
    Digit7: ['selectHero', HERO_KEYS[0]], Digit8: ['selectHero', HERO_KEYS[1]], Digit9: ['selectHero', HERO_KEYS[2]],
    ArrowLeft: ['moveCursor', -1], ArrowRight: ['moveCursor', 1], Enter: ['placeOrUpgrade'], NumpadEnter: ['placeOrUpgrade'],
    KeyI: ['sendUnit', UNIT_KEYS[0]], KeyO: ['sendUnit', UNIT_KEYS[1]], KeyP: ['sendUnit', UNIT_KEYS[2]],
    ArrowUp: ['changeLane', -1], ArrowDown: ['changeLane', 1], KeyL: ['useUlt']
  };
  window.addEventListener('keydown', (e) => {
    if (!VS.active || !S || S.over || S.paused || netRole === 'watch') return;
    const c = e.code;
    if ((e.target === $('vs-commentary') || e.target === $('vs-net-exit')) && (c === 'Enter' || c === 'Space')) return;
    const command = primaryKeys[c] || (!netRole && secondaryKeys[c]);
    if (command) {
      e.preventDefault();
      playerInput(netRole || (primaryKeys[c] ? 'L' : 'R'), ...command);
    }
  });

  /* ---------------- 点击地图上的空位 ---------------- */
  function canvasPoint(ev) {
    const rect = canvas.getBoundingClientRect();
    const x = (ev.clientX - rect.left) / rect.width * W;
    const y = (ev.clientY - rect.top) / rect.height * H;
    return [x, y];
  }
  canvas.addEventListener('pointerdown', (ev) => {
    if (!VS.active || !S || netRole === 'watch') return;
    const [x, y] = canvasPoint(ev);
    const reach = ev.pointerType === 'touch' ? Math.max(34, 22 * W / canvas.clientWidth) : 34;
    for (const side of ['L', 'R']) {
      if (netRole && side !== netRole) continue;
      const idx = S.P[side].towers.findIndex((t) => dist2(t.x, t.y, x, y) <= reach * reach);
      if (idx >= 0) { playerInput(side, 'placeOrUpgrade', idx); return; }
    }
  });
  canvas.addEventListener('pointermove', (ev) => {
    if (!netRole || netRole === 'watch' || !VS.active || S?.paused || S?.over) return;
    const now = performance.now();
    if (now - pointerAt < 70) return;
    pointerAt = now;
    playerInput(netRole, 'pointer', ...canvasPoint(ev).map(Math.round));
  });
  canvas.addEventListener('pointerleave', () => {
    if (netRole && netRole !== 'watch') playerInput(netRole, 'pointer');
  });

  /* =========================================================
   * 绘制
   * ========================================================= */
  function render() {
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    J.applyShake(ctx);
    drawBackground();
    drawLaneMarkers();
    for (const side of ['L', 'R']) drawSide(S.P[side]);
    const units = S.units.map((u) => visualPosition(u, interpolation?.units));
    units.sort((a, b) => a.y - b.y).forEach(drawUnit);
    drawProjectiles();
    drawEffects();
    for (const tx of S.texts) {
      ctx.globalAlpha = 1 - tx.t / tx.max;
      ctx.font = 'bold 17px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      ctx.lineWidth = 3; ctx.strokeStyle = '#000a'; ctx.strokeText(tx.text, tx.x, tx.y);
      ctx.fillStyle = tx.color; ctx.fillText(tx.text, tx.x, tx.y);
      ctx.globalAlpha = 1;
    }
    J.drawParticles(ctx);
    if (netRole) drawRemotePointers();
    ctx.restore();
    J.drawFlash(ctx, W, H);
    if (S.ultFlash) drawUltFlash();
    if (S.phase === 'countdown') drawCountdown();
  }

  function visualPosition(item, from) {
    const previous = from?.get(item.id);
    if (!previous || S.paused) return item;
    const t = clamp((performance.now() - interpolation.at) / SNAPSHOT_MS, 0, 1);
    return { ...item, x: previous.x + (item.x - previous.x) * t, y: previous.y + (item.y - previous.y) * t };
  }

  function drawRemotePointers() {
    for (const side of ['L', 'R']) {
      const p = S.P[side];
      if (side === netRole || !p.pointer) continue;
      ctx.save();
      ctx.translate(...p.pointer);
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = p.team.color;
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, 0); ctx.lineTo(16, 7); ctx.lineTo(8, 9); ctx.lineTo(6, 17); ctx.closePath();
      ctx.fill(); ctx.stroke();
      ctx.restore();
    }
  }

  function drawBackground() {
    const img = getImg(V.bg);
    if (img) { ctx.drawImage(img, 0, 0, W, H); return; }
    // ---- 占位：左右半场 + 中间九龙江 + 三条路 ----
    ctx.fillStyle = '#e6d6b0'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(200,16,46,0.07)'; ctx.fillRect(0, 0, W / 2, H);
    ctx.fillStyle = 'rgba(212,160,23,0.10)'; ctx.fillRect(W / 2, 0, W / 2, H);
    ctx.strokeStyle = '#d8c69c'; ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = 0; y < H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    ctx.fillStyle = '#6fa8c9';
    ctx.beginPath(); ctx.moveTo(455, 0);
    for (let y = 0; y <= H; y += 20) ctx.lineTo(455 + Math.sin(y / 50 + S.time) * 6, y);
    for (let y = H; y >= 0; y -= 20) ctx.lineTo(505 + Math.sin(y / 45 + S.time) * 6, y);
    ctx.closePath(); ctx.fill();
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    for (const lane of S.lanes) {
      ctx.strokeStyle = '#8c7350'; ctx.lineWidth = 46; strokePts(lane.pts);
      ctx.strokeStyle = '#d2bb90'; ctx.lineWidth = 37; strokePts(lane.pts);
    }
    ctx.setLineDash([10, 14]); ctx.strokeStyle = '#ffffff66'; ctx.lineWidth = 2;
    for (const lane of S.lanes) strokePts(lane.pts);
    ctx.setLineDash([]);
  }
  function strokePts(pts) {
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.stroke();
  }

  // 每方当前选择的出兵路线：在路口画闪烁箭头
  function drawLaneMarkers() {
    const pulse = 0.55 + 0.45 * Math.sin(S.time * 6);
    for (const side of ['L', 'R']) {
      const p = S.P[side], lane = S.lanes[p.lane];
      const d = 46, [x, y] = lanePos(lane, side === 'L' ? d : lane.total - d);
      const [x2, y2] = lanePos(lane, side === 'L' ? d + 10 : lane.total - d - 10);
      const a = Math.atan2(y2 - y, x2 - x);
      ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.globalAlpha = pulse * (netRole && netRole !== side ? 0.52 : 1);
      ctx.fillStyle = p.team.color; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(-8, -12); ctx.lineTo(-3, 0); ctx.lineTo(-8, 12); ctx.closePath();
      ctx.fill(); ctx.stroke();
      ctx.restore(); ctx.globalAlpha = 1;
    }
  }

  function drawSide(p) {
    // 土楼
    let { x, y } = p.tulou;
    const img = getImg('tulou.png');
    if (p.hitT > 0) x += Math.sin(S.time * 70) * 5 * Math.min(1, p.hitT / 0.3);
    ctx.fillStyle = p.team.color; ctx.globalAlpha = 0.35;
    ctx.beginPath(); ctx.arc(x, y, 58, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
    if (img) ctx.drawImage(img, x - 52, y - 52, 104, 104);
    else {
      ctx.fillStyle = '#4a3326'; ctx.beginPath(); ctx.arc(x, y, 46, 0, 7); ctx.fill();
      ctx.fillStyle = '#c9a36b'; ctx.beginPath(); ctx.arc(x, y, 39, 0, 7); ctx.fill();
      ctx.fillStyle = '#8b6b3e'; ctx.beginPath(); ctx.arc(x, y, 22, 0, 7); ctx.fill();
      ctx.fillStyle = p.team.color; ctx.beginPath(); ctx.arc(x, y, 9, 0, 7); ctx.fill();
    }
    // 旗帜
    ctx.fillStyle = p.team.color; ctx.font = 'bold 15px "KaiTi", serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 3; ctx.strokeStyle = '#000a';
    ctx.strokeText(p.team.name, x, y + 68); ctx.fillText(p.team.name, x, y + 68);

    // 有背景时石台已画在图上，只额外绘制当前光标。
    const hasBg = !!getImg(V.bg);
    p.towers.forEach((tw, i) => {
      const isCursor = i === p.cursor && S.phase === 'fight';
      if (tw.hero) drawTower(tw, p.team.color);
      else if (!hasBg) {
        ctx.globalAlpha = 0.85;
        ctx.fillStyle = '#0002'; ctx.strokeStyle = p.team.color; ctx.lineWidth = 2; ctx.setLineDash([6, 5]);
        ctx.beginPath(); ctx.arc(tw.x, tw.y, 24, 0, 7); ctx.fill(); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = p.team.color; ctx.font = 'bold 20px sans-serif'; ctx.fillText('+', tw.x, tw.y + 1);
        ctx.globalAlpha = 1;
      }
      if (isCursor) {
        ctx.save();
        if (netRole && netRole !== p.side) ctx.globalAlpha = 0.52;
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 3;
        const r = 32 + Math.sin(S.time * 8) * 2;
        ctx.beginPath(); ctx.arc(tw.x, tw.y, r, 0, 7); ctx.stroke();
        ctx.strokeStyle = p.team.color; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(tw.x, tw.y, r + 3, 0, 7); ctx.stroke();
        ctx.restore();
      }
    });
  }

  function drawTower(tw, color) {
    const h = D.heroes[tw.hero], img = getImg(h.img), bob = 0;
    ctx.fillStyle = color; ctx.globalAlpha = 0.8;
    ctx.beginPath(); ctx.ellipse(tw.x, tw.y + 18, 26, 9, 0, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
    const punch = tw.anim > 0 ? tw.anim / 0.18 : 0;
    const lk = tw.lunge > 0 ? tw.lunge / 0.15 : 0;
    const sp = tw.spawnT > 0 ? tw.spawnT / 0.3 : 0;
    const ox = (tw.lx || 0) * 12 * lk, oy = (tw.ly || 0) * 12 * lk - 70 * sp * sp;
    ctx.save();
    ctx.translate(tw.x + ox, tw.y + 18 + oy); ctx.scale(1 + 0.14 * punch - 0.1 * sp, 1 - 0.12 * punch + 0.15 * sp); ctx.translate(-tw.x, -(tw.y + 18));
    if (img) {
      ctx.save();
      if (tw.side === 'R') { ctx.translate(tw.x * 2, 0); ctx.scale(-1, 1); }   // 金方木偶朝左
      ctx.drawImage(img, tw.x - 38, tw.y - 50 + bob, 76, 76);
      ctx.restore();
    } else {
      ctx.fillStyle = h.color;
      ctx.beginPath(); ctx.moveTo(tw.x - 18, tw.y + 18); ctx.lineTo(tw.x - 12, tw.y - 6 + bob); ctx.lineTo(tw.x + 12, tw.y - 6 + bob); ctx.lineTo(tw.x + 18, tw.y + 18); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#f5d7b5'; ctx.beginPath(); ctx.arc(tw.x, tw.y - 15 + bob, 12, 0, 7); ctx.fill();
      ctx.fillStyle = h.color; ctx.fillRect(tw.x - 13, tw.y - 31 + bob, 26, 7);
      ctx.fillStyle = '#fff'; ctx.font = 'bold 14px "KaiTi", serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(h.short, tw.x, tw.y + 7 + bob);
    }
    ctx.restore();
    ctx.fillStyle = '#f3d27a'; ctx.font = '11px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('★'.repeat(tw.level), tw.x, tw.y + 31);
  }

  function drawUnit(u) {
    const img = getImg(u.t.img), r = u.t.r * 0.9, color = V.teams[u.owner].color;
    const hop = Math.abs(Math.sin(S.time * 8 + u.wob)) * (u.stunT > 0 ? 0 : 3);
    // 脚下的阵营色圈
    ctx.fillStyle = color; ctx.globalAlpha = 0.75;
    ctx.beginPath(); ctx.ellipse(u.x, u.y + r * 0.7, r * 1.05, r * 0.4, 0, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
    if (img) {
      const sz = r * 3.2, sq = u.squash > 0 ? u.squash / 0.14 : 0;
      ctx.save(); ctx.translate(u.x, u.y - r * 0.5 - hop);
      ctx.scale((u.faceLeft ? -1 : 1) * (1 + 0.2 * sq), 1 - 0.16 * sq);
      if (u.flash > 0) ctx.filter = 'brightness(2.8) saturate(0.2)';
      ctx.drawImage(img, -sz / 2, -sz * 0.62, sz, sz);
      ctx.restore();
    } else {
      ctx.fillStyle = u.t.color; ctx.beginPath(); ctx.arc(u.x, u.y - hop, r, 0, 7); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(u.x - r * 0.35, u.y - r * 0.2 - hop, r * 0.25, 0, 7); ctx.arc(u.x + r * 0.35, u.y - r * 0.2 - hop, r * 0.25, 0, 7); ctx.fill();
    }
    if (u.slowT > 0) { ctx.strokeStyle = '#9fd3ff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(u.x, u.y - hop, r + 4, 0, 7); ctx.stroke(); }
    if (u.stunT > 0) { ctx.fillStyle = '#f3d27a'; ctx.font = '13px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('福', u.x, u.y - r - 14); }
    const w = r * 2.2;
    ctx.fillStyle = '#000a'; ctx.fillRect(u.x - w / 2, u.y - r - 10 - hop, w, 5);
    ctx.fillStyle = color; ctx.fillRect(u.x - w / 2, u.y - r - 10 - hop, w * clamp(u.hp / u.maxHp, 0, 1), 5);
  }

  function drawProjectiles() {
    for (const shot of S.projectiles) {
      const p = visualPosition(shot, interpolation?.shots);
      if (p.h.type === 'aoe') {
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(S.time * 12);
        ctx.fillStyle = '#c8102e'; ctx.fillRect(-7, -3, 14, 6);
        ctx.fillStyle = '#f3d27a'; ctx.fillRect(5, -1, 5, 2);
        ctx.restore();
      } else {
        ctx.strokeStyle = '#9fd3ff'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(p.x, p.y, 7, 0, Math.PI * 1.3); ctx.stroke();
      }
    }
  }

  function drawEffects() {
    for (const fx of S.effects) {
      const k = fx.t / fx.max;
      ctx.globalAlpha = 1 - k;
      if (fx.type === 'boom') {
        ctx.fillStyle = '#ffb347'; ctx.beginPath(); ctx.arc(fx.x, fx.y, fx.r * (0.4 + k * 0.6), 0, 7); ctx.fill();
      } else if (fx.type === 'ring') {
        ctx.strokeStyle = fx.color; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(fx.x, fx.y, fx.r * (0.5 + k), 0, 7); ctx.stroke();
      } else if (fx.type === 'slash') {
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(fx.x, fx.y, 18, -1.2 + k * 2, 0.6 + k * 2); ctx.stroke();
      } else if (fx.type === 'poof') {
        ctx.fillStyle = fx.color; ctx.beginPath(); ctx.arc(fx.x, fx.y, 8 + k * 20, 0, 7); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  }

  function drawUltFlash() {
    const { side, t } = S.ultFlash, k = t / 1.2;
    const x0 = side === 'L' ? 0 : W / 2;
    ctx.fillStyle = side === 'L' ? `rgba(200,16,46,${0.3 * k})` : `rgba(212,160,23,${0.35 * k})`;
    ctx.fillRect(x0, 0, W / 2, H);
    ctx.save(); ctx.translate(x0 + W / 4, H / 2); ctx.scale(1 + (1 - k) * 0.5, 1 + (1 - k) * 0.5);
    ctx.globalAlpha = k;
    ctx.fillStyle = '#c8102e'; ctx.rotate(Math.PI / 4); ctx.fillRect(-70, -70, 140, 140); ctx.rotate(-Math.PI / 4);
    ctx.fillStyle = '#f3d27a'; ctx.font = 'bold 115px "KaiTi", serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('福', 0, 6);
    ctx.restore(); ctx.globalAlpha = 1;
  }

  function drawCountdown() {
    const n = Math.ceil(S.countdown);
    const txt = n > 3 ? '准备' : n >= 1 ? String(n) : '开战！';
    const k = S.countdown - Math.floor(S.countdown);
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(0, 0, W, H);
    ctx.save(); ctx.translate(W / 2, H / 2); ctx.scale(1 + k * 0.6, 1 + k * 0.6);
    ctx.font = 'bold 120px "KaiTi", serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 8; ctx.strokeStyle = '#8a0b20'; ctx.strokeText(txt, 0, 0);
    ctx.fillStyle = '#f3d27a'; ctx.fillText(txt, 0, 0);
    ctx.restore();
    ctx.font = 'bold 22px "KaiTi", serif'; ctx.textAlign = 'center';
    ctx.fillStyle = '#fff'; ctx.fillText('红方 VS 金方 · 先打爆对方土楼获胜', W / 2, H / 2 + 95);
    ctx.font = '13px sans-serif'; ctx.fillStyle = '#ffd0d6';
    if (netRole === 'watch') ctx.fillText('观战中', W / 2, H / 2 + 128);
    else if (netRole) ctx.fillText(KEY_HINT.L + '（也可用鼠标或触屏）', W / 2, H / 2 + 128);
    else {
      ctx.fillText('红方 ' + KEY_HINT.L, W / 2, H / 2 + 128);
      ctx.fillStyle = '#ffeaa0'; ctx.fillText('金方 ' + KEY_HINT.R + '（也可以直接用鼠标/触屏点）', W / 2, H / 2 + 150);
    }
  }

  /* ---------------- 每帧（由 game.js 主循环调用） ---------------- */
  VS.frame = function (dt) {
    if (!S) return;
    if (!netRole || (netRole === 'L' && !document.hidden)) update(dt);
    if (!S) return;
    if (!S.paused) J.updateParticles(dt);
    render();
    updateUi();
  };

  // 测试 / 扩展入口
  VS.api = {
    sendUnit: (side, type) => playerInput(side, 'sendUnit', type),
    placeOrUpgrade: (side, idx) => playerInput(side, 'placeOrUpgrade', idx),
    useUlt: (side) => playerInput(side, 'useUlt'),
    selectHero: (side, key) => playerInput(side, 'selectHero', key),
    changeLane: (side, dir) => playerInput(side, 'changeLane', dir)
  };
})();
