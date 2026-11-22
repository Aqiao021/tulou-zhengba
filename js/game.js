/* =========================================================
 * 《土楼争霸》游戏主逻辑
 * 结构：工具 → 素材/音效/存档 → 战斗(G) → 更新 → 绘制 → 界面/输入 → 主循环
 * 画布逻辑尺寸固定 960×540，自动适配屏幕。
 * ========================================================= */
(function () {
  'use strict';

  const D = window.GAME_DATA;
  const W = 960, H = 540;
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const $ = (id) => document.getElementById(id);

  /* ---------------- 工具 ---------------- */
  const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const dist2 = (ax, ay, bx, by) => (ax - bx) ** 2 + (ay - by) ** 2;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  function setupCanvas() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    const scale = Math.max(1, (rect.width / W) * dpr);
    canvas.width = Math.round(W * scale);
    canvas.height = Math.round(H * scale);
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
  }
  window.addEventListener('resize', setupCanvas);

  /* ---------------- 素材：图片缺失时自动用占位图形 ---------------- */
  const images = {};
  const imageLoads = new Map();
  function loadImage(name, priority = 'auto') {
    if (!name) return Promise.resolve(null);
    if (!imageLoads.has(name)) {
      imageLoads.set(name, new Promise((resolve) => {
        const img = new Image();
        img.fetchPriority = priority;
        img.onload = () => { images[name] = img; resolve(img); };
        img.onerror = () => resolve(null);
        img.src = 'assets/images/' + name;
      }));
    }
    return imageLoads.get(name);
  }
  const getImg = (name) => images[name] || null;
  function preload() {
    loadImage('tulou.png');
    Object.values(D.heroes).forEach((h) => loadImage(h.img));
    Object.values(D.enemies).forEach((e) => loadImage(e.img));
    D.levels.forEach((l) => loadImage(l.bg));
    if (D.versus) loadImage(D.versus.bg);
  }

  /* ---------------- 音效：assets/sfx/ 有 mp3 就用 mp3，没有就用 juice.js 现场合成 ---------------- */
  const Sound = {
    on: true,
    ready: {},
    init() {
      const names = (window.JUICE && JUICE.SFX_NAMES) || [];
      names.forEach((n) => {
        try {
          const a = new Audio();
          a.preload = 'auto';
          a.oncanplaythrough = () => { this.ready[n] = a; };
          a.src = 'assets/sfx/' + n + '.mp3';
        } catch (e) { /* 忽略 */ }
      });
    },
    play(name) {
      if (!this.on) return;
      const a = this.ready[name];
      if (a) {
        try { const s = a.cloneNode(); s.volume = 0.5; s.play().catch(() => {}); } catch (e) { /* 忽略 */ }
      } else if (window.JUICE) JUICE.sfx(name);
    }
  };
  Sound.init();

  /* ---------------- 存档（浏览器本地） ---------------- */
  const Store = {
    get(k, d) { try { const v = localStorage.getItem('tulou_' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('tulou_' + k, JSON.stringify(v)); } catch (e) { /* 忽略 */ } }
  };
  const save = {
    cleared: Store.get('cleared', []),   // 已通关的关卡序号
    cards: Store.get('cards', []),       // 已解锁的知识卡
    levelBests: Store.get('levelBests', {}),
    pendingSeals: Store.get('pendingSeals', [])
  };
  if (!Array.isArray(save.cleared)) save.cleared = [];
  if (!Array.isArray(save.cards)) save.cards = [];
  if (!Array.isArray(save.pendingSeals)) save.pendingSeals = [];
  if (!save.levelBests || typeof save.levelBests !== 'object' || Array.isArray(save.levelBests)) save.levelBests = {};
  const seenCardSave = Store.get('seenCards', null);
  const seenCards = new Set(Array.isArray(seenCardSave) ? seenCardSave : save.cards);
  let galleryCelebrated = Store.get('galleryCelebrated', false) === true;

  const collection = {
    has: (key) => save.cards.includes(key),
    fresh: (key) => save.cards.includes(key) && !seenCards.has(key),
    view(key) {
      if (!save.cards.includes(key) || seenCards.has(key)) return;
      seenCards.add(key);
      Store.set('seenCards', [...seenCards]);
    },
    celebrate() {
      if (galleryCelebrated) return false;
      galleryCelebrated = true;
      Store.set('galleryCelebrated', true);
      return true;
    }
  };

  function recordClear() {
    const { levelIndex, L, hp, maxHp, kills } = G;
    const { max, half } = D.levelMap.stars;
    const stars = hp === maxHp ? max : hp >= maxHp * half ? 2 : 1;
    const best = save.levelBests[L.id];
    if (!best || stars > best.stars || (stars === best.stars &&
        (hp > best.hp || (hp === best.hp && kills > best.kills)))) {
      save.levelBests[L.id] = { stars, kills, hp, maxHp };
      Store.set('levelBests', save.levelBests);
    }
    if (!save.cleared.includes(levelIndex)) {
      save.pendingSeals.push(L.id);
      Store.set('pendingSeals', save.pendingSeals);
      save.cleared.push(levelIndex);
      Store.set('cleared', save.cleared);
    }
  }

  const levelProgress = {
    isCleared: (index) => save.cleared.includes(index),
    isUnlocked: (index) => Number.isInteger(index) && Boolean(D.levels[index]) &&
      (index === 0 || save.cleared.includes(index - 1) || save.cleared.includes(index)),
    best: (id) => save.levelBests[id] ?? null,
    pendingSeal: (id) => save.pendingSeals.includes(id),
    markSealed(id) {
      save.pendingSeals = save.pendingSeals.filter((levelId) => levelId !== id);
      Store.set('pendingSeals', save.pendingSeals);
    }
  };

  function unlockCard(key) {
    if (!key || save.cards.includes(key)) return false;
    Store.set('seenCards', [...seenCards]);
    save.cards.push(key); Store.set('cards', save.cards); return true;
  }

  /* =========================================================
   * 战斗状态 G
   * ========================================================= */
  let G = null;

  function buildPath(points) {
    const segs = []; let total = 0;
    for (let i = 0; i < points.length - 1; i++) {
      const [x1, y1] = points[i], [x2, y2] = points[i + 1];
      const len = Math.hypot(x2 - x1, y2 - y1);
      segs.push({ x1, y1, x2, y2, len, start: total });
      total += len;
    }
    return { segs, total };
  }
  function posAt(d) {
    const segs = G.path.segs;
    for (const s of segs) {
      if (d <= s.start + s.len) {
        const t = Math.max(0, d - s.start) / s.len;
        return [s.x1 + (s.x2 - s.x1) * t, s.y1 + (s.y2 - s.y1) * t];
      }
    }
    const last = segs[segs.length - 1];
    return [last.x2, last.y2];
  }

  function newBattle(levelIndex) {
    const L = D.levels[levelIndex];
    if (!L) return;
    const end = L.path[L.path.length - 1];
    G = {
      levelIndex, L,
      path: buildPath(L.path),
      tulou: { x: end[0] + 18, y: end[1] },
      fu: L.startFu, hp: L.towerHP, maxHp: L.towerHP, fuqi: 0,
      waveIdx: -1, spawnQueue: [], spawnTimer: 0, waveCooldown: 3,
      enemies: [], projectiles: [], effects: [], texts: [],
      towers: L.slots.map(([x, y]) => ({ x, y, hero: null, level: 0, cd: 0, anim: 0, damage: 0 })),
      selected: null, showRange: null, ultFlash: 0,
      time: 0, speed: 1, paused: false, over: false,
      kills: 0, recentKills: [], lastComment: -99, lowHpSaid: false, wasCritical: false,
      placedOnce: false, chouPlaced: false
    };
    if (window.JUICE) JUICE.clear();
    $('hud-level').textContent = L.name;
    buildShop();
    showScreen(null);
    $('hud').classList.remove('hidden');
    $('dock').classList.remove('hidden');
    $('btn-speed').textContent = '×1';
    clearCommentary();
    showComment(L.subtitle);
  }

  function heroStats(tw) {
    const h = D.heroes[tw.hero], U = D.upgrade, lv = tw.level - 1;
    return {
      h,
      dmg: h.dmg * (1 + U.dmgPerLevel * lv),
      range: h.range * (1 + U.rangePerLevel * lv),
      rate: h.rate * (1 - 0.08 * lv)
    };
  }
  const upgradeCost = (tw) => Math.round(D.heroes[tw.hero].cost * D.upgrade.costRate * tw.level);

  /* ---------------- 波次 ---------------- */
  function startNextWave() {
    G.waveIdx++;
    const wave = G.L.waves[G.waveIdx];
    G.spawnQueue = [];
    wave.forEach((grp) => {
      for (let i = 0; i < grp.count; i++) G.spawnQueue.push({ type: grp.type, gap: grp.gap });
    });
    G.spawnTimer = 0;
    comment('waveStart', true);
    Sound.play('wave');
    JUICE.shake(2.5, 0.25);
  }

  function spawnEnemy(type) {
    const t = D.enemies[type];
    const hp = t.hp * G.L.hpScale * (1 + G.waveIdx * 0.06);
    const [x, y] = posAt(0);
    G.enemies.push({ type, t, hp, maxHp: hp, d: 0, x, y, slowT: 0, slowF: 1, stunT: 0, dead: false, wob: Math.random() * 6 });
  }

  /* ---------------- 伤害 / 击败 ---------------- */
  // kind: melee 近战 / slow 扇风 / aoe 鞭炮 / ult 大招
  const NUM_COLOR = { melee: '#ffffff', slow: '#cfe8ff', aoe: '#ffd34d', ult: '#ffe28a' };
  function damage(e, amount, kind, tower) {
    if (e.dead) return;
    const hpBefore = e.hp;
    e.hp -= amount;
    if (recordTowerHit(tower, hpBefore, e.hp, G.time)) {
      comment('towerStreak', true, { hero: D.heroes[tower.hero].name });
    }
    e.flash = 0.09;                       // 命中闪白
    e.squash = 0.14;                      // 被打扁一下
    if (kind === 'melee') e.d = Math.max(0, e.d - 8);       // 近战击退
    else if (kind === 'slow') e.d = Math.max(0, e.d - 3);
    JUICE.number(e.x, e.y - e.t.r - 16, amount, NUM_COLOR[kind] || '#fff', kind === 'melee' || kind === 'ult' || amount >= 30);
    if (e.hp <= 0) {
      e.dead = true;
      G.fu += e.t.reward;
      G.fuqi = Math.min(D.ult.need, G.fuqi + 1);
      G.kills++;
      G.recentKills.push(G.time);
      floatText(e.x, e.y - 30, '+' + e.t.reward, '#f3d27a');
      G.effects.push({ type: 'poof', x: e.x, y: e.y, t: 0, max: 0.4, color: e.t.color });
      killFx(e);
    }
  }

  function killFx(e) {
    const big = e.type === 'big';
    JUICE.sparks(e.x, e.y, big ? 16 : 8, ['#fff3c4', '#ffd34d', e.t.color], big ? 340 : 230);
    JUICE.dust(e.x, e.y + e.t.r * 0.6, big ? 9 : 4);
    JUICE.ring(e.x, e.y, big ? 70 : 40, '#fff', 0.3, big ? 6 : 4);
    const [fx, fy] = fuTarget();
    JUICE.coins(e.x, e.y, big ? 5 : 2, fx, fy, bumpFu);
    if (big) { JUICE.shake(7, 0.28); JUICE.hitstop(0.07); Sound.play('bigkill'); }
    else Sound.play('kill');
  }

  // 福币栏在画布上的位置（金币飞过去）
  function fuTarget() {
    try {
      const r = $('hud-fu').getBoundingClientRect(), c = canvas.getBoundingClientRect();
      return [(r.left + r.width / 2 - c.left) / c.width * W, (r.top + r.height / 2 - c.top) / c.height * H];
    } catch (e) { return [130, 22]; }
  }
  function bumpFu() {
    const chip = $('hud-fu').parentElement;
    chip.classList.remove('bump'); void chip.offsetWidth; chip.classList.add('bump');
  }

  function floatText(x, y, text, color) {
    G.texts.push({ x, y, text, color, t: 0, max: 0.9 });
  }

  /* ---------------- 解说 ---------------- */
  const narration = D.narration;
  const commentaryBox = $('commentary');
  const commentaryText = $('commentary-text');
  const commentaryAvatar = $('commentary-avatar');
  const commentaryButtons = [$('btn-commentary'), $('vs-commentary')];
  let commentaryOn = Store.get('commentary', true) !== false;
  let commentTimer = null;
  let commentPriority = 0;

  $('commentary-icon').textContent = narration.placeholder;
  commentaryAvatar.onload = () => { commentaryAvatar.hidden = false; };
  commentaryAvatar.onerror = () => { commentaryAvatar.hidden = true; };
  commentaryAvatar.src = 'assets/images/' + narration.avatar;

  function clearCommentary() {
    clearTimeout(commentTimer);
    commentPriority = 0;
    commentaryBox.classList.remove('show');
    commentaryText.textContent = '';
  }

  function updateCommentaryButtons() {
    for (const button of commentaryButtons) {
      button.textContent = commentaryOn ? narration.on : narration.off;
      button.setAttribute('aria-pressed', String(commentaryOn));
    }
  }

  commentaryButtons.forEach((button) => button.addEventListener('click', () => {
    commentaryOn = !commentaryOn;
    Store.set('commentary', commentaryOn);
    if (!commentaryOn) clearCommentary();
    updateCommentaryButtons();
    Sound.play('click');
  }));
  updateCommentaryButtons();

  function showComment(line, priority = 1) {
    if (!commentaryOn || priority < commentPriority) return false;
    clearTimeout(commentTimer);
    commentPriority = priority;
    commentaryText.textContent = line;
    commentaryBox.classList.add('show');
    commentTimer = setTimeout(clearCommentary, narration.holdMs);
    return true;
  }

  function announce(kind, values = {}) {
    const lines = D.commentary[kind];
    if (!lines?.length) return false;
    const priority = narration.highPriority.includes(kind) ? 3 : narration.featured.includes(kind) ? 2 : 1;
    return showComment(rand(lines).replace(/\{(\w+)\}/g, (match, key) => values[key] ?? match), priority);
  }

  function comment(kind, force, values) {
    if (!G) return;
    if (!force && G.time - G.lastComment < 3.5) return;
    if (announce(kind, values)) G.lastComment = G.time;
  }

  // 记实际扣掉的敌人生命值。全局大招没有所属木偶。
  function recordTowerHit(tower, hpBefore, hpAfter, now) {
    if (!tower) return false;
    tower.damage += Math.max(0, hpBefore - Math.max(0, hpAfter));
    if (hpAfter > 0) return false;
    const times = (tower.killTimes || []).filter((time) => now - time <= narration.streakSeconds);
    times.push(now);
    const streak = times.length >= narration.streakCount;
    tower.killTimes = streak ? [] : times;
    return streak;
  }

  /* =========================================================
   * 更新
   * ========================================================= */
  function update(dt) {
    if (!G || G.paused || G.over) return;
    G.time += dt;

    // 出怪 / 波次推进
    if (G.spawnQueue.length) {
      G.spawnTimer -= dt;
      if (G.spawnTimer <= 0) {
        const it = G.spawnQueue.shift();
        spawnEnemy(it.type);
        G.spawnTimer = it.gap;
      }
    } else if (G.enemies.length === 0) {
      if (G.waveIdx >= G.L.waves.length - 1) { endBattle(true); return; }
      G.waveCooldown -= dt;
      if (G.waveCooldown <= 0) { startNextWave(); G.waveCooldown = 4; }
    }

    // 敌人移动
    for (const e of G.enemies) {
      if (e.dead) continue;
      if (e.flash > 0) e.flash -= dt;
      if (e.squash > 0) e.squash -= dt;
      if (e.stunT > 0) e.stunT -= dt;
      else e.d += e.t.speed * (e.slowT > 0 ? e.slowF : 1) * dt;
      if (e.slowT > 0) e.slowT -= dt;
      const px = e.x;
      [e.x, e.y] = posAt(e.d);
      if (Math.abs(e.x - px) > 0.01) e.faceLeft = e.x < px;
      if (e.d >= G.path.total) {
        e.dead = true;
        G.hp = Math.max(0, G.hp - e.t.dmg);
        if (G.hp < G.maxHp * narration.lowHpRatio) G.wasCritical = true;
        G.effects.push({ type: 'ring', x: G.tulou.x, y: G.tulou.y, t: 0, max: 0.5, color: '#ff4040', r: 60 });
        floatText(G.tulou.x, G.tulou.y - 60, '-' + e.t.dmg, '#ff6060');
        Sound.play('leak');
        JUICE.shake(9, 0.3); JUICE.screenFlash('#ff2020', 0.35);
        JUICE.dust(G.tulou.x, G.tulou.y + 30, 10, '#c9a36b');
        G.tulouHit = 0.3;
        comment('leak');
        if (G.hp <= 0) { endBattle(false); return; }
        if (!G.lowHpSaid && G.hp <= G.maxHp * narration.lowHpRatio) { G.lowHpSaid = true; comment('lowHp', true); }
      }
    }

    // 木偶攻击
    for (const tw of G.towers) {
      if (!tw.hero) continue;
      tw.anim = Math.max(0, tw.anim - dt);
      tw.lunge = Math.max(0, (tw.lunge || 0) - dt);
      tw.spawnT = Math.max(0, (tw.spawnT || 0) - dt);
      tw.cd -= dt;
      if (tw.cd > 0) continue;
      const st = heroStats(tw);
      const r2 = st.range * st.range;
      let target = null;
      for (const e of G.enemies) {
        if (!e.dead && dist2(tw.x, tw.y, e.x, e.y) <= r2 && (!target || e.d > target.d)) target = e;
      }
      if (!target) continue;
      tw.cd = st.rate;
      tw.anim = 0.18;
      fire(tw, st, target);
    }

    // 飞行道具
    for (const p of G.projectiles) {
      if (p.target && !p.target.dead) { p.tx = p.target.x; p.ty = p.target.y; }
      const dx = p.tx - p.x, dy = p.ty - p.y, d = Math.hypot(dx, dy), step = p.speed * dt;
      if (d <= step) { p.x = p.tx; p.y = p.ty; p.done = true; hitProjectile(p); }
      else { p.x += dx / d * step; p.y += dy / d * step; }
    }

    // 连杀解说
    G.recentKills = G.recentKills.filter((t) => G.time - t < 1.3);
    if (G.recentKills.length >= 3) { comment('multiKill', true); G.recentKills = []; }

    // 清理
    G.enemies = G.enemies.filter((e) => !e.dead);
    G.projectiles = G.projectiles.filter((p) => !p.done);
    for (const fx of G.effects) fx.t += dt;
    G.effects = G.effects.filter((fx) => fx.t < fx.max);
    for (const tx of G.texts) { tx.t += dt; tx.y -= 30 * dt; }
    G.texts = G.texts.filter((tx) => tx.t < tx.max);
    if (G.ultFlash > 0) G.ultFlash -= dt;
    if (G.tulouHit > 0) G.tulouHit -= dt;
    if (G.showRange && (G.showRange.t -= dt) <= 0) G.showRange = null;
  }

  function fire(tw, st, target) {
    const h = st.h;
    const dx = target.x - tw.x, dy = target.y - tw.y, d = Math.hypot(dx, dy) || 1;
    if (h.melee) {
      // 近战：往前一扑，砍！
      tw.lx = dx / d; tw.ly = dy / d; tw.lunge = 0.15;
      damage(target, st.dmg, 'melee', tw);
      G.effects.push({ type: 'slash', x: target.x, y: target.y, t: 0, max: 0.2, color: h.color });
      JUICE.sparks(target.x, target.y - 6, 7, ['#ffffff', '#ffd34d', '#ff9a3c'], 280);
      JUICE.shake(1.6, 0.08);
      Sound.play('hit');
      return;
    }
    // 远程：后坐一下
    tw.lx = -dx / d * 0.5; tw.ly = -dy / d * 0.5; tw.lunge = 0.12;
    G.projectiles.push({
      x: tw.x, y: tw.y - 10, tx: target.x, ty: target.y, target,
      speed: h.type === 'aoe' ? 360 : 480, dmg: st.dmg, h, tower: tw, level: tw.level, done: false
    });
    Sound.play(h.type === 'aoe' ? 'throw' : 'fan');
  }

  function hitProjectile(p) {
    const h = p.h;
    if (h.type === 'aoe') {
      const r = h.splash * (1 + 0.1 * (p.level - 1));
      for (const e of G.enemies) if (!e.dead && dist2(p.x, p.y, e.x, e.y) <= r * r) damage(e, p.dmg, 'aoe', p.tower);
      G.effects.push({ type: 'boom', x: p.x, y: p.y, t: 0, max: 0.35, color: h.color, r });
      // 鞭炮炸开：火花 + 红纸屑 + 冲击波
      JUICE.sparks(p.x, p.y, 14, ['#ffd34d', '#ff6a00', '#ffffff'], 320);
      JUICE.confetti(p.x, p.y, 16, ['#c8102e', '#e8392f', '#ffd34d', '#b30000']);
      JUICE.ring(p.x, p.y, r * 1.15, '#ffb347', 0.3, 5);
      JUICE.dust(p.x, p.y + 6, 5, '#9a8a7a');
      JUICE.shake(3.5, 0.14);
      Sound.play('boom');
    } else if (p.target && !p.target.dead) {
      damage(p.target, p.dmg, 'slow', p.tower);
      JUICE.sparks(p.x, p.y, 5, ['#e6f4ff', '#9fd3ff'], 170);
      if (h.type === 'slow') {
        p.target.slowT = h.slowTime;
        p.target.slowF = h.slow;
        G.effects.push({ type: 'ring', x: p.x, y: p.y, t: 0, max: 0.3, color: '#9fd3ff', r: 22 });
      }
    }
  }

  function useUlt() {
    if (!G || G.over || G.fuqi < D.ult.need) return;
    G.fuqi = 0;
    JUICE.hitstop(0.18);
    JUICE.shake(14, 0.55);
    JUICE.screenFlash('#ffd34d', 0.5);
    JUICE.glyphs(W / 2, H / 2, 12, '福', '#ffd34d');
    JUICE.confetti(W / 2, H / 2, 40, ['#c8102e', '#ffd34d', '#e8392f'], 420);
    for (const e of G.enemies) {
      e.stunT = D.ult.stun;
      JUICE.sparks(e.x, e.y, 4, ['#ffd34d', '#fff'], 200);
      damage(e, D.ult.dmg, 'ult');
    }
    G.ultFlash = 1.2;
    comment('ult', true);
    Sound.play('ult');
  }

  function endBattle(win) {
    G.over = true;
    G.win = win;
    let resultCue = win ? 'win' : 'lose';
    if (win && G.wasCritical) resultCue = 'comeback';
    else if (win && G.hp === G.maxHp) resultCue = 'fullWin';
    comment(resultCue, true);
    Sound.play(win ? 'win' : 'lose');
    if (win) {
      for (let i = 0; i < 5; i++) JUICE.confetti(120 + i * 180, 60, 24, ['#c8102e', '#ffd34d', '#e8392f', '#fff3c4'], 300);
      JUICE.glyphs(G.tulou.x, G.tulou.y, 8, '福', '#ffd34d');
    } else { JUICE.shake(12, 0.6); JUICE.screenFlash('#400000', 0.8); }
    if (win) recordClear();
    const battle = G;
    setTimeout(() => {
      if (G !== battle) return;
      $('hud').classList.add('hidden');
      $('dock').classList.add('hidden');
      const cardKey = G.L.card;
      if (win && unlockCard(cardKey)) showCard(cardKey, () => showResult(win));
      else showResult(win);
    }, 1200);
  }

  /* =========================================================
   * 绘制
   * ========================================================= */
  function render() {
    ctx.clearRect(0, 0, W, H);
    if (!G) {
      if (!window.TULOU_MENU?.active) drawMenuBg();
      return;
    }
    ctx.save();
    JUICE.applyShake(ctx);
    drawBackground();
    drawSlots();
    drawTulou();
    for (const tw of G.towers) if (tw.hero) drawTower(tw);
    G.enemies.slice().sort((a, b) => a.y - b.y).forEach(drawEnemy);
    drawProjectiles();
    drawEffects();
    if (G.showRange) {
      const st = heroStats(G.showRange.tw);
      ctx.strokeStyle = '#fff8'; ctx.fillStyle = '#fff1'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(G.showRange.tw.x, G.showRange.tw.y, st.range, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
    for (const tx of G.texts) {
      ctx.globalAlpha = 1 - tx.t / tx.max;
      ctx.font = 'bold 18px sans-serif'; ctx.textAlign = 'center';
      ctx.lineWidth = 3; ctx.strokeStyle = '#000a'; ctx.strokeText(tx.text, tx.x, tx.y);
      ctx.fillStyle = tx.color; ctx.fillText(tx.text, tx.x, tx.y);
      ctx.globalAlpha = 1;
    }
    JUICE.drawParticles(ctx);
    ctx.restore();
    JUICE.drawFlash(ctx, W, H);
    if (G.ultFlash > 0) drawUltFlash();
    if (!G.spawnQueue.length && !G.enemies.length && !G.over && G.waveIdx < G.L.waves.length - 1) {
      ctx.font = 'bold 26px "KaiTi", serif'; ctx.textAlign = 'center';
      ctx.fillStyle = '#f3d27a'; ctx.strokeStyle = '#000a'; ctx.lineWidth = 4;
      const s = `第 ${G.waveIdx + 2} 波 ${Math.ceil(G.waveCooldown)} 秒后来袭`;
      const y = commentaryBox.classList.contains('show') ? 113 : 90;
      ctx.strokeText(s, W / 2, y); ctx.fillText(s, W / 2, y);
    }
  }

  function drawMenuBg() {
    // 菜单背景：缓慢旋转的土楼剪影
    const t = performance.now() / 1000;
    ctx.save(); ctx.translate(W / 2, H * 0.62); ctx.rotate(t * 0.05);
    ctx.globalAlpha = 0.12;
    for (let r = 260; r > 60; r -= 50) {
      ctx.strokeStyle = '#f3d27a'; ctx.lineWidth = 14;
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();
    }
    for (let i = 0; i < 24; i++) {
      ctx.rotate(Math.PI / 12);
      ctx.fillStyle = '#f3d27a'; ctx.fillRect(210, -4, 50, 8);
    }
    ctx.restore(); ctx.globalAlpha = 1;
  }

  function drawBackground() {
    const img = getImg(G.L.bg);
    if (img) { ctx.drawImage(img, 0, 0, W, H); return; }
    // ---- 占位背景 ----
    const jiang = G.L.theme === 'jiang';
    ctx.fillStyle = jiang ? '#cfe0c3' : '#e8d9b8';
    ctx.fillRect(0, 0, W, H);
    // 地砖纹理
    ctx.strokeStyle = jiang ? '#bcd0ae' : '#dccaa3'; ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = 0; y < H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    if (jiang) {
      // 九龙江
      ctx.fillStyle = '#6fa8c9';
      ctx.beginPath(); ctx.moveTo(0, 270);
      for (let x = 0; x <= W; x += 20) ctx.lineTo(x, 270 + Math.sin(x / 60 + G.time) * 8);
      for (let x = W; x >= 0; x -= 20) ctx.lineTo(x, 320 + Math.sin(x / 50 + G.time) * 8);
      ctx.closePath(); ctx.fill();
    } else {
      // 古城屋顶（红瓦块）
      ctx.fillStyle = '#b5482f';
      [[40, 30], [380, 40], [880, 40], [60, 470], [640, 470], [840, 440], [400, 520]].forEach(([x, y]) => {
        ctx.beginPath(); ctx.moveTo(x - 34, y + 12); ctx.lineTo(x, y - 12); ctx.lineTo(x + 34, y + 12); ctx.closePath(); ctx.fill();
      });
    }
    // 道路
    const pts = G.L.path;
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.strokeStyle = '#8c7350'; ctx.lineWidth = 52; strokePath(pts);
    ctx.strokeStyle = jiang ? '#d8c39a' : '#cdb48a'; ctx.lineWidth = 42; strokePath(pts);
    ctx.setLineDash([10, 14]); ctx.strokeStyle = '#ffffff55'; ctx.lineWidth = 2; strokePath(pts); ctx.setLineDash([]);
  }
  function strokePath(pts) {
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.stroke();
  }

  function drawSlots() {
    const sel = G.selected && G.fu >= D.heroes[G.selected].cost;
    const hasBg = !!getImg(G.L.bg);
    for (const tw of G.towers) {
      if (tw.hero) continue;
      if (hasBg) {
        // 背景已画好石台：平时不画，选中木偶时发光提示
        if (!G.selected) continue;
        const pulse = 0.5 + 0.5 * Math.sin(G.time * 6);
        ctx.globalAlpha = sel ? 0.6 + 0.4 * pulse : 0.35;
        ctx.strokeStyle = '#c8102e'; ctx.lineWidth = 5;
        ctx.beginPath(); ctx.arc(tw.x, tw.y, 29, 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = '#ffd34d'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(tw.x, tw.y, 29, 0, Math.PI * 2); ctx.stroke();
        ctx.globalAlpha = 1;
        continue;
      }
      ctx.fillStyle = sel ? '#fff4' : '#0002';
      ctx.strokeStyle = sel ? '#fff' : '#6b5a3f';
      ctx.lineWidth = 2; ctx.setLineDash([6, 5]);
      ctx.beginPath(); ctx.arc(tw.x, tw.y, 26, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = sel ? '#fff' : '#6b5a3f'; ctx.font = 'bold 22px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('+', tw.x, tw.y + 1);
    }
  }

  function drawTulou() {
    let { x, y } = G.tulou;
    const img = getImg('tulou.png');
    if (G.tulouHit > 0) x += Math.sin(G.time * 70) * 5 * (G.tulouHit / 0.3);
    if (img) ctx.drawImage(img, x - 60, y - 60, 120, 120);
    else {
      // 占位：俯视圆形土楼
      ctx.fillStyle = '#4a3326'; ctx.beginPath(); ctx.arc(x, y, 50, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#c9a36b'; ctx.beginPath(); ctx.arc(x, y, 43, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#5a3d2b'; ctx.lineWidth = 1.5;
      for (let i = 0; i < 24; i++) {
        const a = i / 24 * Math.PI * 2;
        ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * 26, y + Math.sin(a) * 26); ctx.lineTo(x + Math.cos(a) * 43, y + Math.sin(a) * 43); ctx.stroke();
      }
      ctx.fillStyle = '#8b6b3e'; ctx.beginPath(); ctx.arc(x, y, 24, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#c8102e'; ctx.beginPath(); ctx.arc(x, y, 10, 0, Math.PI * 2); ctx.fill();
    }
    // 血条
    const w = 90, pct = G.hp / G.maxHp;
    ctx.fillStyle = '#000a'; ctx.fillRect(x - w / 2, y - 70, w, 9);
    ctx.fillStyle = pct > 0.3 ? '#4cd964' : '#ff3b30'; ctx.fillRect(x - w / 2 + 1, y - 69, (w - 2) * pct, 7);
  }

  function drawTower(tw) {
    const h = D.heroes[tw.hero], img = getImg(h.img);
    const bob = 0;
    // 底座
    ctx.fillStyle = '#5b6770'; ctx.beginPath(); ctx.ellipse(tw.x, tw.y + 18, 26, 9, 0, 0, Math.PI * 2); ctx.fill();
    const punch = tw.anim > 0 ? tw.anim / 0.18 : 0;          // 出手瞬间挤压
    const lk = tw.lunge > 0 ? tw.lunge / 0.15 : 0;            // 前扑/后坐
    const sp = tw.spawnT > 0 ? tw.spawnT / 0.3 : 0;           // 放下时从天而降
    const ox = (tw.lx || 0) * 12 * lk, oy = (tw.ly || 0) * 12 * lk - 70 * sp * sp;
    const scx = 1 + 0.14 * punch - 0.1 * sp, scy = 1 - 0.12 * punch + 0.15 * sp;
    ctx.save();
    ctx.translate(tw.x + ox, tw.y + 18 + oy); ctx.scale(scx, scy); ctx.translate(-tw.x, -(tw.y + 18));
    if (img) ctx.drawImage(img, tw.x - 40, tw.y - 54 + bob, 80, 80);
    else {
      // 占位：布袋木偶（身体 + 头 + 帽子 + 字）
      ctx.fillStyle = h.color;
      ctx.beginPath(); ctx.moveTo(tw.x - 20, tw.y + 18); ctx.lineTo(tw.x - 14, tw.y - 6 + bob); ctx.lineTo(tw.x + 14, tw.y - 6 + bob); ctx.lineTo(tw.x + 20, tw.y + 18); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#f5d7b5'; ctx.beginPath(); ctx.arc(tw.x, tw.y - 16 + bob, 13, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#2b1b17'; ctx.beginPath(); ctx.arc(tw.x - 4, tw.y - 17 + bob, 1.8, 0, 7); ctx.arc(tw.x + 4, tw.y - 17 + bob, 1.8, 0, 7); ctx.fill();
      if (tw.hero === 'chou') { ctx.fillStyle = '#fff'; ctx.fillRect(tw.x - 5, tw.y - 20 + bob, 10, 7); }
      ctx.fillStyle = h.color; ctx.fillRect(tw.x - 14, tw.y - 33 + bob, 28, 8);
      ctx.fillStyle = '#fff'; ctx.font = 'bold 15px "KaiTi", serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(h.short, tw.x, tw.y + 7 + bob);
    }
    ctx.restore();
    // 等级星
    ctx.fillStyle = '#f3d27a'; ctx.font = '11px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('★'.repeat(tw.level), tw.x, tw.y + 32);
  }

  function drawEnemy(e) {
    const img = getImg(e.t.img), r = e.t.r;
    const hop = Math.abs(Math.sin(G.time * 8 + e.wob)) * (e.stunT > 0 ? 0 : 3);
    ctx.fillStyle = '#0003'; ctx.beginPath(); ctx.ellipse(e.x, e.y + r * 0.8, r, r * 0.35, 0, 0, Math.PI * 2); ctx.fill();
    if (img) {
      const sz = r * 3.3, sq = e.squash > 0 ? e.squash / 0.14 : 0;
      ctx.save(); ctx.translate(e.x, e.y - r * 0.5 - hop);
      ctx.scale((e.faceLeft ? -1 : 1) * (1 + 0.2 * sq), 1 - 0.16 * sq);
      if (e.flash > 0) ctx.filter = 'brightness(2.8) saturate(0.2)';
      ctx.drawImage(img, -sz / 2, -sz * 0.62, sz, sz);
      ctx.restore();
    }
    else {
      ctx.fillStyle = e.t.color; ctx.beginPath(); ctx.arc(e.x, e.y - hop, r, 0, Math.PI * 2); ctx.fill();
      if (e.type === 'big') {
        ctx.fillStyle = '#f3d27a';
        ctx.beginPath(); ctx.moveTo(e.x - 12, e.y - r + 4 - hop); ctx.lineTo(e.x - 8, e.y - r - 10 - hop); ctx.lineTo(e.x - 3, e.y - r + 2 - hop); ctx.fill();
        ctx.beginPath(); ctx.moveTo(e.x + 12, e.y - r + 4 - hop); ctx.lineTo(e.x + 8, e.y - r - 10 - hop); ctx.lineTo(e.x + 3, e.y - r + 2 - hop); ctx.fill();
      }
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(e.x - r * 0.35, e.y - r * 0.2 - hop, r * 0.25, 0, 7); ctx.arc(e.x + r * 0.35, e.y - r * 0.2 - hop, r * 0.25, 0, 7); ctx.fill();
      ctx.fillStyle = '#c8102e';
      ctx.beginPath(); ctx.arc(e.x - r * 0.35, e.y - r * 0.2 - hop, r * 0.11, 0, 7); ctx.arc(e.x + r * 0.35, e.y - r * 0.2 - hop, r * 0.11, 0, 7); ctx.fill();
    }
    if (!img && e.flash > 0) { ctx.fillStyle = '#ffffffcc'; ctx.beginPath(); ctx.arc(e.x, e.y - hop, r, 0, 7); ctx.fill(); }
    if (e.slowT > 0) { ctx.strokeStyle = '#9fd3ff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(e.x, e.y - hop, r + 4, 0, 7); ctx.stroke(); }
    if (e.stunT > 0) { ctx.fillStyle = '#f3d27a'; ctx.font = '14px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('福', e.x, e.y - r - 12); }
    // 血条
    const w = r * 2.2;
    ctx.fillStyle = '#000a'; ctx.fillRect(e.x - w / 2, e.y - r - 9 - hop, w, 5);
    ctx.fillStyle = '#ff5050'; ctx.fillRect(e.x - w / 2, e.y - r - 9 - hop, w * clamp(e.hp / e.maxHp, 0, 1), 5);
  }

  function drawProjectiles() {
    for (const p of G.projectiles) {
      if (p.h.type === 'aoe') {
        // 鞭炮
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(G.time * 12);
        ctx.fillStyle = '#c8102e'; ctx.fillRect(-7, -3, 14, 6);
        ctx.fillStyle = '#f3d27a'; ctx.fillRect(5, -1, 5, 2);
        ctx.restore();
      } else {
        // 扇风
        ctx.strokeStyle = '#9fd3ff'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(p.x, p.y, 7, 0, Math.PI * 1.3); ctx.stroke();
      }
    }
  }

  function drawEffects() {
    for (const fx of G.effects) {
      const k = fx.t / fx.max;
      ctx.globalAlpha = 1 - k;
      if (fx.type === 'boom') {
        ctx.fillStyle = '#ffb347'; ctx.beginPath(); ctx.arc(fx.x, fx.y, fx.r * (0.4 + k * 0.6), 0, 7); ctx.fill();
        ctx.fillStyle = '#c8102e';
        for (let i = 0; i < 8; i++) { const a = i / 8 * 7; ctx.fillRect(fx.x + Math.cos(a) * fx.r * k - 3, fx.y + Math.sin(a) * fx.r * k - 3, 6, 6); }
      } else if (fx.type === 'ring') {
        ctx.strokeStyle = fx.color; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(fx.x, fx.y, fx.r * (0.5 + k), 0, 7); ctx.stroke();
      } else if (fx.type === 'slash') {
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.arc(fx.x, fx.y, 18, -1.2 + k * 2, 0.6 + k * 2); ctx.stroke();
      } else if (fx.type === 'poof') {
        ctx.fillStyle = fx.color; ctx.beginPath(); ctx.arc(fx.x, fx.y, 8 + k * 20, 0, 7); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  }

  function drawUltFlash() {
    const k = G.ultFlash / 1.2;
    ctx.fillStyle = `rgba(212,160,23,${0.35 * k})`; ctx.fillRect(0, 0, W, H);
    ctx.save(); ctx.translate(W / 2, H / 2); ctx.scale(1 + (1 - k) * 0.6, 1 + (1 - k) * 0.6);
    ctx.globalAlpha = k;
    ctx.fillStyle = '#c8102e'; ctx.rotate(Math.PI / 4); ctx.fillRect(-90, -90, 180, 180); ctx.rotate(-Math.PI / 4);
    ctx.fillStyle = '#f3d27a'; ctx.font = 'bold 150px "KaiTi", serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('福', 0, 8);
    ctx.restore(); ctx.globalAlpha = 1;
  }

  /* =========================================================
   * 界面
   * ========================================================= */
  const screens = ['menu', 'levels', 'help', 'gallery', 'card', 'result', 'pause', 'versus', 'vsresult'];
  $('btn-result-map').textContent = D.levelMap.returnMap;
  $('btn-gallery').textContent = D.gallery.title;
  function showScreen(name) {
    if (name !== 'levels') window.TULOU_LEVELMAP?.close();
    if (name !== 'help') window.TULOU_HELP?.close();
    if (name !== 'gallery') window.TULOU_GALLERY?.close();
    screens.forEach((s) => $('screen-' + s).classList.toggle('hidden', s !== name));
    if (name === 'levels') {
      buildLevels();
      window.TULOU_LEVELMAP?.open();
    }
    if (name === 'gallery') window.TULOU_GALLERY?.open();
    if (name === 'help') window.TULOU_HELP?.open();
    if (name === 'menu') {
      window.NET?.leave();
      if (window.VS) window.VS.stop();
      if (window.JUICE) JUICE.clear();
      clearCommentary();
      G = null;
      $('hud').classList.add('hidden');
      $('dock').classList.add('hidden');
    }
  }
  document.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => { Sound.play('click'); showScreen(b.dataset.go); }));

  function buildLevels() {
    const box = $('level-list'); box.innerHTML = '';
    D.levels.forEach((L, i) => {
      const unlocked = levelProgress.isUnlocked(i);
      const div = document.createElement('div');
      div.className = 'level-card' + (unlocked ? '' : ' locked');
      div.innerHTML = `<h3>第${i + 1}关 · ${L.name}</h3><p>${L.subtitle}</p>` +
        (save.cleared.includes(i) ? '<div class="done">✔ 已通关</div>' : '') + (unlocked ? '' : '<p>🔒 先通关上一关</p>');
      if (unlocked) div.addEventListener('click', () => newBattle(i));
      box.appendChild(div);
    });
  }

  let cardCallback = null;
  function showCard(key, cb) {
    const c = D.cards[key];
    $('card-title').textContent = c.title;
    $('card-text').textContent = c.text;
    const imgBox = $('card-img');
    imgBox.textContent = c.title;
    imgBox.style.backgroundImage = '';
    const probe = new Image();
    probe.onload = () => { imgBox.textContent = ''; imgBox.style.backgroundImage = `url(assets/images/${c.img})`; };
    probe.src = 'assets/images/' + c.img;
    cardCallback = cb;
    showScreen('card');
    Sound.play('card');
  }
  $('btn-card-ok').addEventListener('click', () => {
    showScreen(null);
    const cb = cardCallback; cardCallback = null;
    if (cb) cb();
  });

  function showResult(win) {
    $('result-title').textContent = win ? '守住了！' : '土楼失守';
    $('result-stats').innerHTML = `击败敌人 <b>${G.kills}</b> 个　·　土楼剩余 <b>${G.hp}</b> / ${G.maxHp}<br>坚持到第 <b>${G.waveIdx + 1}</b> / ${G.L.waves.length} 波`;
    const hasNext = win && G.levelIndex < D.levels.length - 1;
    $('btn-next-level').classList.toggle('hidden', !hasNext);
    showScreen('result');
  }
  $('btn-next-level').addEventListener('click', () => newBattle(G.levelIndex + 1));
  $('btn-retry').addEventListener('click', () => newBattle(G.levelIndex));

  /* ---------- 商店 ---------- */
  function buildShop() {
    const shop = $('shop'); shop.innerHTML = '';
    Object.entries(D.heroes).forEach(([key, h]) => {
      const b = document.createElement('button');
      b.className = 'hero-btn'; b.dataset.hero = key; b.title = h.desc;
      const img = getImg(h.img);
      b.innerHTML = `<span class="face" style="${img ? `background-image:url(assets/images/${h.img})` : `background-color:${h.color}`}">${img ? '' : h.short}</span>` +
        `<span class="nm">${h.name}</span><span class="cost"><i class="ico-fu">福</i>${h.cost}</span>`;
      b.addEventListener('click', () => {
        G.selected = G.selected === key ? null : key;
        if (G.selected) tip(`${h.name}：${h.desc}。点地图上的空位放下`);
        Sound.play('click');
      });
      shop.appendChild(b);
    });
  }

  let tipTimer = null;
  function tip(text) {
    const el = $('tip'); el.textContent = text; el.classList.add('show');
    clearTimeout(tipTimer); tipTimer = setTimeout(() => el.classList.remove('show'), 2000);
  }

  // HUD 每帧刷新（只改变化的部分）
  const hudCache = {};
  function setText(id, v) { if (hudCache[id] !== v) { hudCache[id] = v; $(id).textContent = v; } }
  function updateHud() {
    if (!G) return;
    setText('hud-fu', String(G.fu));
    setText('hud-hp', String(G.hp));
    setText('hud-wave', `第 ${Math.max(0, G.waveIdx + 1)} / ${G.L.waves.length} 波`);
    const pct = G.fuqi / D.ult.need;
    $('ult-fill').style.width = (pct * 100) + '%';
    const ready = pct >= 1 && !G.over;
    $('btn-ult').disabled = !ready;
    $('btn-ult').classList.toggle('ready', ready);
    $('btn-next').disabled = G.spawnQueue.length > 0 || G.enemies.length > 0 || G.waveIdx >= G.L.waves.length - 1;
    document.querySelectorAll('.hero-btn').forEach((b) => {
      const h = D.heroes[b.dataset.hero];
      b.classList.toggle('sel', G.selected === b.dataset.hero);
      b.classList.toggle('poor', G.fu < h.cost);
    });
  }

  /* ---------- 按钮 ---------- */
  $('btn-ult').addEventListener('click', useUlt);
  $('btn-next').addEventListener('click', () => { if (G) G.waveCooldown = 0; });
  $('btn-speed').addEventListener('click', () => {
    if (!G) return;
    G.speed = G.speed === 1 ? 2 : 1;
    $('btn-speed').textContent = '×' + G.speed;
  });
  $('btn-sound').addEventListener('click', () => {
    Sound.on = !Sound.on;
    $('btn-sound').textContent = Sound.on ? '🔊' : '🔇';
  });
  $('btn-pause').addEventListener('click', () => { if (G && !G.over) { G.paused = true; showScreen('pause'); } });
  $('btn-resume').addEventListener('click', () => {
    showScreen(null);
    if (window.VS && window.VS.active) window.VS.resume(); else if (G) G.paused = false;
  });
  $('btn-quit').addEventListener('click', () => showScreen('menu'));
  window.addEventListener('keydown', (e) => {
    if (!G || G.over) return;
    if (e.code === 'Space' && e.target !== $('btn-commentary')) { e.preventDefault(); useUlt(); }
    const keys = Object.keys(D.heroes), n = parseInt(e.key, 10);
    if (n >= 1 && n <= keys.length) G.selected = G.selected === keys[n - 1] ? null : keys[n - 1];
    if (e.key === 'Escape') G.selected = null;
  });

  /* ---------- 点击地图：放木偶 / 升级 ---------- */
  canvas.addEventListener('pointerdown', (ev) => {
    if (!G || G.over || G.paused) return;
    const rect = canvas.getBoundingClientRect();
    const x = (ev.clientX - rect.left) / rect.width * W;
    const y = (ev.clientY - rect.top) / rect.height * H;
    const reach = ev.pointerType === 'touch' ? Math.max(34, 22 * W / rect.width) : 34;
    const tw = G.towers.find((t) => dist2(t.x, t.y, x, y) <= reach * reach);
    if (!tw) { G.selected = null; return; }

    if (!tw.hero) {
      if (!G.selected) { tip('先在下方选一个木偶（或按数字键 1/2/3）'); return; }
      const h = D.heroes[G.selected];
      if (G.fu < h.cost) { tip('福币不够啦，多打几只小妖'); return; }
      G.fu -= h.cost;
      tw.hero = G.selected; tw.level = 1; tw.cd = 0.35; tw.spawnT = 0.3;
      setTimeout(() => { JUICE.dust(tw.x, tw.y + 18, 9); JUICE.ring(tw.x, tw.y + 14, 40, '#fff3c4', 0.3, 4); JUICE.shake(2.5, 0.1); }, 280);
      G.showRange = { tw, t: 1.2 };
      G.effects.push({ type: 'ring', x: tw.x, y: tw.y, t: 0, max: 0.4, color: '#f3d27a', r: 30 });
      Sound.play('place');
      if (tw.hero === 'chou' && !G.chouPlaced) {
        G.chouPlaced = true;
        comment('firstChou', true);
      } else comment('place');
      if (!G.placedOnce) {
        G.placedOnce = true;
        if (unlockCard('muou')) tip(D.gallery.puppetUnlocked);
      }
      return;
    }

    G.showRange = { tw, t: 1.5 };
    if (tw.level >= D.upgrade.maxLevel) { tip(`${D.heroes[tw.hero].name} 已经满级`); return; }
    const cost = upgradeCost(tw);
    if (G.fu < cost) { tip(`升级需要 ${cost} 福币`); return; }
    G.fu -= cost; tw.level++;
    tw.anim = 0.18;
    JUICE.sparkleUp(tw.x, tw.y, 16);
    JUICE.ring(tw.x, tw.y, 46, '#ffd34d', 0.4, 5);
    floatText(tw.x, tw.y - 40, '升级!', '#fff');
    G.effects.push({ type: 'ring', x: tw.x, y: tw.y, t: 0, max: 0.5, color: '#fff', r: 34 });
    Sound.play('upgrade');
    comment('upgrade');
  });

  /* =========================================================
   * 主循环
   * ========================================================= */
  let last = performance.now();
  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const gdt = window.JUICE ? JUICE.tick(dt) : dt;   // 顿帧时游戏几乎停住
    if (window.TULOU_INTRO?.active) {
      window.TULOU_INTRO.frame(now, gdt);
    } else if (window.TULOU_FORTUNE?.open) {
      window.TULOU_FORTUNE.frame(gdt);
    } else if (window.VS && window.VS.active) {
      window.VS.frame(gdt);   // 双人对决模式接管画面
    } else if (window.TULOU_LEVELMAP?.active) {
      window.TULOU_LEVELMAP.frame(now, gdt);
    } else if (window.TULOU_GALLERY?.active) {
      window.TULOU_GALLERY.frame(gdt);
    } else if (window.TULOU_HELP?.active) {
      window.TULOU_HELP.frame(gdt);
    } else {
      if (G) {
        const steps = G.speed;
        for (let i = 0; i < steps; i++) update(gdt);
        if (!G.paused) JUICE.updateParticles(gdt * steps);
      } else window.TULOU_MENU?.frame(gdt);
      render();
      updateHud();
    }
    requestAnimationFrame(loop);
  }

  preload();
  setupCanvas();
  showScreen('menu');
  requestAnimationFrame(loop);

  $('btn-versus').addEventListener('click', () => { Sound.play('click'); window.VS?.open(); });

  // 公共工具，给 versus.js 等其他模式复用
  window.TULOU_CORE = { W, H, ctx, canvas, getImg, loadImage, Sound, showComment, announce, clearCommentary,
    recordTowerHit, showScreen, newBattle, levelProgress, collection, tip, rand, dist2, clamp };

  // 调试/扩展入口（给 Codex 和测试用）
  window.TULOU = { get G() { return G; }, newBattle, useUlt, showScreen, D };
})();
