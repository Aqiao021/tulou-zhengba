/* 《土楼争霸》开场。沿用 game.js 的 requestAnimationFrame 和 JUICE 时钟。 */
(function () {
  'use strict';

  const stage = document.getElementById('intro');
  const canvas = document.getElementById('intro-canvas');
  const action = document.getElementById('intro-action');
  const label = action.querySelector('span');
  const progress = document.getElementById('intro-progress');
  const menuScreen = document.getElementById('screen-menu');
  const core = window.TULOU_CORE;
  const juice = window.JUICE;
  const data = window.GAME_DATA;
  const ctx = canvas.getContext('2d');
  if (!core || !juice || !data?.intro || !ctx) {
    stage.hidden = true;
    return;
  }

  const { W, H } = core;
  const cfg = data.intro;
  const cue = cfg.cues;
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const titleFont = '"Intro Title", "Microsoft YaHei", sans-serif';
  const latinFont = '700 23px "Intro Latin", sans-serif';
  const gold = '#f5b316';
  const red = '#c8102e';
  const ink = '#14100e';
  const center = W / 2;
  const palette = ['#fff4bf', '#f5b316', '#f66937'];
  const art = {};
  const lampGap = .055;
  const glyphGap = .13;
  const glyphStart = cue.banner + .08;
  const impactHold = .12;
  const clamp = (x) => Math.max(0, Math.min(1, x));
  const over = (time, start, duration) => clamp((time - start) / duration);
  const ease = (x) => 1 - (1 - x) ** 3;
  const title = Array.from(cfg.title);

  let phase = 'entry';
  let startAt = 0;
  let readyAt = 0;
  let exitAt = 0;
  let loaded = false;
  let eventIndex = 0;
  let nextPetal = cue.latin;
  let artX = 1;
  let artY = 1;
  let entryDirty = true;
  let backdrop;
  let vignette;
  let lampGlow;

  function resize() {
    const { width } = stage.getBoundingClientRect();
    const scale = Math.min(2, Math.max(.72, width * (window.devicePixelRatio || 1) / W));
    canvas.width = Math.round(W * scale);
    canvas.height = Math.round(H * scale);
    artX = canvas.width / W;
    artY = canvas.height / H;
    entryDirty = true;
    ctx.setTransform(artX, 0, 0, artY, 0, 0);
    backdrop = ctx.createRadialGradient(center, 304, 16, center, 304, 560);
    backdrop.addColorStop(0, '#551224');
    backdrop.addColorStop(.6, '#25101b');
    backdrop.addColorStop(1, '#100a14');
    vignette = ctx.createRadialGradient(center, 234, 154, center, 275, 574);
    vignette.addColorStop(0, '#0d071100');
    vignette.addColorStop(1, '#0d0711aa');
    lampGlow = ctx.createRadialGradient(0, 0, 1, 0, 0, 33);
    lampGlow.addColorStop(0, '#fff5b1');
    lampGlow.addColorStop(.22, '#ffbd47e0');
    lampGlow.addColorStop(.43, '#ff562f88');
    lampGlow.addColorStop(1, '#d9091700');
  }

  function setPhase(name, text, ariaLabel = text) {
    phase = name;
    stage.dataset.phase = name;
    action.setAttribute('aria-label', ariaLabel);
    label.textContent = text;
    progress.hidden = loaded && name !== 'entry';
  }

  function preload() {
    const menu = window.TULOU_MENU;
    const sceneArt = Object.entries({
      bg: cfg.background, mid: cfg.midground, fg: cfg.foreground, emblem: cfg.emblem
    }).map(([key, path]) => core.loadImage(path, key === 'bg' ? 'high' : 'auto').then((image) => {
      art[key] = image;
      if (key === 'bg') entryDirty = true;
    }));
    const cards = new Set([...data.levels.map((level) => level.card), 'muou']);
    const files = new Set([
      'tulou.png', ...Object.values(data.heroes).map((hero) => hero.img),
      ...Object.values(data.enemies).map((enemy) => enemy.img),
      ...data.levels.map((level) => level.bg), data.versus.bg,
      ...Array.from(cards, (key) => data.cards[key]?.img),
      data.fortune.logo, data.fortune.footerLogo
    ]);
    const tasks = [
      ...sceneArt, ...Array.from(files, (file) => core.loadImage(file)),
      ...(menu?.artLoads ?? []), menu?.ready,
      document.fonts?.load('66px ' + titleFont, cfg.title),
      document.fonts?.load(latinFont, cfg.subtitle)
    ].filter(Boolean);
    let completed = 0;
    const settled = () => {
      if (!loaded) progress.value = ++completed / tasks.length;
    };
    const finish = () => {
      loaded = true;
      progress.value = 1;
      progress.hidden = phase !== 'entry';
    };
    const deadline = window.setTimeout(finish, cfg.loadTimeout);
    Promise.all(tasks.map((task) => task.then(settled, settled))).then(() => {
      window.clearTimeout(deadline);
      finish();
    });
  }

  function sound(name) {
    if (core.Sound.on) juice.sfx(name);
  }

  function showEnd(now) {
    if (loaded) {
      readyAt = now;
      setPhase('ready', cfg.play);
    } else {
      setPhase('waiting', cfg.loading);
    }
  }

  /* ---------- 退场：开门入场 ----------
   * 0.00–0.26s 蓄力：画面中缝亮起一道金光，轻震、鼓点
   * 0.26s      破门：锣声 + 鞭炮，白闪、强震，火花和红纸屑从门缝喷出
   * 0.26–1.21s 开场画面像两扇大门向镜头外推开（分条透视），门后金光迸射
   *            主菜单从 1.16 倍、过曝状态冲到正常大小
   */
  const EXIT = { charge: .26, open: .95, total: 1.35 };
  const snap = document.createElement('canvas');
  let burstDone = false;

  function beginExit(now) {
    exitAt = now;
    setPhase('exit', '');
    burstDone = false;
    // 拍下当前开场画面，作为两扇门的"门板"
    snap.width = canvas.width; snap.height = canvas.height;
    const sctx = snap.getContext('2d');
    sctx.drawImage(canvas, 0, 0);
    stage.style.background = 'transparent';
    menuScreen.style.transformOrigin = '50% 55%';
    menuScreen.style.transform = 'scale(1.16)';
    menuScreen.style.filter = 'brightness(1.9) saturate(1.2)';
    if (!motion.matches) { sound('drum'); juice.shake(4, EXIT.charge); }
  }

  function burst() {
    burstDone = true;
    sound('wave'); sound('boom');
    juice.screenFlash('#fff6dc', .16);
    juice.shake(12, .35);
    for (let i = 0; i < 5; i++) {
      const y = 70 + i * 100;
      juice.sparks(center, y, 14, palette, 520);
      juice.confetti(center, y, 12, [red, '#ee4b3d', gold, '#fff1c4'], 420);
    }
    juice.ring(center, H / 2, 420, gold, .5, 8);
  }

  // 一扇门：side = -1 左门（门轴在左边缘），1 右门（门轴在右边缘）
  function door(side, angle, alpha) {
    const strips = 40, D = 1100, cy = H / 2;
    const half = W / 2, pw = snap.width / 2;
    const cos = Math.cos(angle), sin = Math.sin(angle);
    const hingeX = side < 0 ? 0 : W;
    ctx.save();
    ctx.globalAlpha = alpha;
    for (let i = 0; i < strips; i++) {
      // u：离门轴的距离
      const u0 = half * i / strips, u1 = half * (i + 1) / strips;
      const proj = (u) => {
        const x = hingeX - side * u * cos;          // 门板转过去后的水平位置
        const z = u * sin;                          // 朝镜头方向凸出
        const f = D / (D - z);
        return [center + (x - center) * f, f];
      };
      const [x0, f0] = proj(u0), [x1, f1] = proj(u1);
      const f = (f0 + f1) / 2;
      const left = Math.min(x0, x1), w = Math.abs(x1 - x0) + .6;
      // 源图：左门取左半边（从左往右），右门取右半边（从右往左）
      const srcU = side < 0 ? (pw * i / strips) : (snap.width - pw * (i + 1) / strips);
      ctx.drawImage(snap, srcU, 0, pw / strips + .5, snap.height, left, cy - cy * f, w, H * f);
      // 转得越多越暗，像门板背光
      ctx.fillStyle = `rgba(20,8,6,${Math.min(.55, sin * .55 * (u1 / half))})`;
      ctx.fillRect(left, cy - cy * f, w, H * f);
    }
    // 门的内侧边缘：一道金边
    const [ex] = (() => { const u = half, x = hingeX - side * u * cos, z = u * sin, f = D / (D - z); return [center + (x - center) * f, f]; })();
    ctx.globalAlpha = alpha * (1 - sin * .6);
    ctx.fillStyle = gold;
    ctx.fillRect(ex - (side < 0 ? 3 : 0), 0, 3, H);
    ctx.restore();
  }

  function exitPaint(t) {
    ctx.setTransform(artX, 0, 0, artY, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    juice.applyShake(ctx);
    const charge = over(t, 0, EXIT.charge);
    const open = over(t, EXIT.charge, EXIT.open);
    const swing = 1 - (1 - open) ** 3;                        // 先猛后缓：破门而出
    if (open <= 0) {
      // 蓄力：整张画面微微推近，中缝金光越来越亮
      const z = 1 + .03 * ease(charge);
      ctx.drawImage(snap, center * (1 - z), H / 2 * (1 - z), W * z, H * z);
      ctx.globalCompositeOperation = 'screen';
      const g = ctx.createLinearGradient(center - 40, 0, center + 40, 0);
      g.addColorStop(0, '#f5b31600'); g.addColorStop(.5, `rgba(255,236,170,${.95 * charge})`); g.addColorStop(1, '#f5b31600');
      ctx.fillStyle = g;
      ctx.fillRect(center - 40 * (.3 + charge), 0, 80 * (.3 + charge), H);
      ctx.globalCompositeOperation = 'source-over';
    } else {
      // 门后迸出的金光
      const light = Math.sin(Math.min(1, open * 1.3) * Math.PI);
      ctx.globalCompositeOperation = 'screen';
      const rg = ctx.createRadialGradient(center, H / 2, 10, center, H / 2, 300 + 520 * swing);
      rg.addColorStop(0, `rgba(255,244,200,${.9 * light})`);
      rg.addColorStop(.4, `rgba(245,179,22,${.45 * light})`);
      rg.addColorStop(1, 'rgba(200,16,46,0)');
      ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H);
      // 放射光束
      ctx.save(); ctx.translate(center, H / 2); ctx.rotate(t * .6);
      ctx.fillStyle = `rgba(255,230,150,${.18 * light})`;
      for (let i = 0; i < 12; i++) {
        ctx.rotate(Math.PI / 6);
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(900, -40); ctx.lineTo(900, 40); ctx.closePath(); ctx.fill();
      }
      ctx.restore();
      ctx.globalCompositeOperation = 'source-over';
      const angle = swing * 1.5;                               // 最多转到约 86°
      const alpha = 1 - over(t, EXIT.charge + EXIT.open * .7, EXIT.open * .3);
      door(-1, angle, alpha);
      door(1, angle, alpha);
    }
    juice.drawParticles(ctx);
    ctx.restore();
    juice.drawFlash(ctx, W, H);
  }

  function finish() {
    stage.hidden = true;
    stage.style.background = '';
    menuScreen.style.transform = '';
    menuScreen.style.filter = '';
    menuScreen.style.transition = '';
    canvas.width = canvas.height = reflection.width = reflection.height = 1;
    menuScreen.inert = false;
    if (document.activeElement === action) action.blur();
    window.removeEventListener('keydown', keydown, true);
    window.removeEventListener('resize', resize);
    juice.clear();
    window.NET?.autoJoin();
  }

  function activate() {
    const now = performance.now();
    if (phase === 'entry') {
      startAt = now;
      if (core.Sound.on) juice.unlock().then((unlocked) => {
        if (unlocked && !stage.hidden && performance.now() - startAt < 400) sound('wave');
      });
      if (motion.matches) showEnd(now);
      else setPhase('playing', '', cfg.skip);
    } else if (phase === 'playing') {
      juice.clear();
      showEnd(now);
    } else if (phase === 'ready') {
      beginExit(now);
    }
  }

  function keydown(event) {
    if (stage.hidden || phase === 'entry') return;
    event.preventDefault();
    event.stopPropagation();
    if (!event.repeat) activate();
  }

  function imageLayer(image, zoom, opacity) {
    if (!image || opacity <= 0) return;
    ctx.globalAlpha = opacity;
    ctx.drawImage(image, center * (1 - zoom), H / 2 * (1 - zoom), W * zoom, H * zoom);
    ctx.globalAlpha = 1;
  }

  function lanterns(time, zoom) {
    if (!art.mid) return;
    ctx.save();
    ctx.translate(center, H / 2);
    ctx.scale(zoom, zoom);
    ctx.translate(-center, -H / 2);
    ctx.globalCompositeOperation = 'screen';
    cfg.lanterns.forEach(([x, y], index) => {
      const light = over(time, cue.lanterns + index * lampGap, .12);
      if (!light) return;
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(1.12, .89);
      ctx.globalAlpha = ease(light) * (.72 + .085 * Math.sin(time * 6 + index));
      ctx.fillStyle = lampGlow;
      ctx.fillRect(-34, -34, 68, 68);
      ctx.restore();
    });
    ctx.restore();
  }

  function river(time) {
    if (!art.bg || motion.matches || time < cue.latin) return;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    for (let i = 0; i < 23; i++) {
      const x = (i * 139 + 22) % W;
      const y = 478 + (i * 17) % 55;
      const ripple = Math.sin(time * (2 + i % 3) * 1.3 + i * 2.1);
      ctx.fillStyle = i % 3 === 0 ? '#f6b45d' : '#a43e33';
      ctx.globalAlpha = (.08 + .14 * Math.max(0, ripple)) * over(time, cue.latin, .25);
      ctx.fillRect(x + ripple * 8, y, 10 + (i * 13) % 31, i % 5 === 0 ? 2 : 1);
    }
    ctx.restore();
  }

  function scenery(time) {
    const push = motion.matches ? 0 : Math.min(1, time / 6);
    const middleZoom = 1.025 + push * .065;
    imageLayer(art.bg, 1.025 + push * .025, ease(over(time, 0, .42)));
    river(time);
    imageLayer(art.mid, middleZoom, ease(over(time, .13, .43)) * .76);
    lanterns(time, middleZoom);
    imageLayer(art.fg, 1.025 + push * .10, ease(over(time, .25, .42)));
    ctx.fillStyle = vignette;
    ctx.fillRect(-24, -24, W + 48, H + 48);
  }

  function polygon(points, fill, stroke, lineWidth) {
    ctx.beginPath();
    for (const [x, y] of points) ctx.lineTo(x, y);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = lineWidth;
      ctx.lineJoin = 'round';
      ctx.stroke();
    }
  }

  function blades(time) {
    const p = over(time, cue.blades, .22);
    if (p <= 0 || p >= 1) return;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = Math.sin(p * Math.PI) * .93;
    for (const [direction, color] of [[1, '#eb233d'], [-1, gold]]) {
      ctx.save();
      ctx.translate(center + direction * (p - .5) * 960, 228 + (p - .5) * 350);
      ctx.rotate(direction * .43 + (direction < 0 ? Math.PI : 0));
      ctx.shadowColor = color;
      ctx.shadowBlur = 27;
      polygon([[-260, 0], [-30, -12], [164, 0], [-48, 9]], color);
      ctx.shadowBlur = 0;
      polygon([[-213, 0], [-22, -3.6], [139, 0], [-51, 2.8]], '#fff1c4');
      ctx.restore();
    }
    ctx.restore();
  }

  function write(text, x, y, font, fill, outline) {
    ctx.font = font;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    if (outline) {
      ctx.lineWidth = outline;
      ctx.strokeStyle = ink;
      ctx.strokeText(text, x, y);
    }
    ctx.fillStyle = fill;
    ctx.fillText(text, x, y);
  }

  function emblem(time) {
    const arrival = over(time, cue.impact - .16, .16);
    if (!arrival) return;
    const normal = 307;
    const y = 218 + 47 * (1 - arrival);
    const bounce = over(time, cue.impact + impactHold, .28);
    const size = Math.min(2.5 * normal, (Math.min(y, H - y) - 14) * 2,
      normal * (1 + 1.5 * (1 - arrival ** 2) + Math.sin(bounce * 2 * Math.PI) * .035));
    const alpha = .28 + arrival * .72;
    ctx.save();
    ctx.globalAlpha = alpha;
    if (art.emblem) {
      const left = center - size / 2;
      const top = y - size / 2;
      ctx.shadowColor = '#ff9d3866';
      ctx.shadowBlur = 26;
      ctx.drawImage(art.emblem, left, top, size, size);
      ctx.shadowBlur = 0;
      const sweep = over(time, cue.shine, .4);
      if (sweep > 0 && sweep < 1) shine(left, top, size, sweep);
    } else {
      ctx.globalAlpha *= 1 - over(time, cue.banner, .28);
      write(cfg.title, center, y, '83px ' + titleFont, gold, 9);
    }
    ctx.restore();
  }

  // Work on a small separate canvas so the reflection follows the emblem's alpha.
  const reflection = document.createElement('canvas');
  reflection.width = reflection.height = 360;
  const reflected = reflection.getContext('2d');
  function shine(left, top, size, sweep) {
    if (!reflected) return;
    const w = reflection.width;
    const x = -70 + sweep * (w + 240);
    reflected.clearRect(0, 0, w, w);
    reflected.drawImage(art.emblem, 0, 0, w, w);
    const gradient = reflected.createLinearGradient(x - 72, 0, x + 72, -50);
    gradient.addColorStop(0, '#fff5cf00');
    gradient.addColorStop(.5, '#fff8dcdd');
    gradient.addColorStop(1, '#fff5cf00');
    reflected.globalCompositeOperation = 'source-in';
    reflected.fillStyle = gradient;
    reflected.fillRect(0, 0, w, w);
    reflected.globalCompositeOperation = 'source-over';
    ctx.drawImage(reflection, left, top, size, size);
  }

  function banner(time) {
    const spread = ease(over(time, cue.banner, .26));
    if (!spread) return;
    const points = [[-261, -26], [-182, -43], [182, -43], [261, -26],
                    [236, 0], [257, 36], [175, 29], [144, 44], [-144, 44],
                    [-175, 29], [-257, 36], [-236, 0]];
    ctx.save();
    ctx.translate(center, 370);
    ctx.scale(spread, 1);
    ctx.shadowColor = '#f4a94e69';
    ctx.shadowBlur = 12;
    polygon(points, ink, gold, 4);
    ctx.shadowBlur = 0;
    polygon([[-228, -17], [-182, -25], [-198, -6], [-222, -3]], red);
    polygon([[228, -17], [182, -25], [198, -6], [222, -3]], red);
    ctx.restore();
  }

  function titles(time) {
    const step = 82;
    title.forEach((character, index) => {
      const drop = over(time, glyphStart + index * glyphGap - .055, .055);
      if (!drop) return;
      const settle = over(time, glyphStart + index * glyphGap, .16);
      const scale = 1 + .45 * (1 - drop) - .10 * Math.sin(settle * Math.PI);
      ctx.save();
      ctx.translate(center + (index - (title.length - 1) / 2) * step, 371 - 30 * (1 - drop));
      ctx.scale(scale, scale);
      ctx.globalAlpha = drop;
      write(character, 3, 4, '66px ' + titleFont, red);
      write(character, 0, 0, '66px ' + titleFont, gold, 4);
      ctx.restore();
    });
    const latin = over(time, cue.latin, .33);
    if (!latin) return;
    ctx.save();
    ctx.globalAlpha = ease(latin);
    polygon([[-129, -16], [129, -16], [115, 11], [101, 21], [-101, 21], [-115, 11]]
      .map(([x, y]) => [x + center, y + 427]), ink, gold, 2.4);
    ctx.font = latinFont;
    const letters = Array.from(cfg.subtitle);
    const gap = 5;
    const widths = letters.map((letter) => ctx.measureText(letter).width);
    let x = center - (widths.reduce((sum, width) => sum + width, 0) + (letters.length - 1) * gap) / 2;
    letters.forEach((letter, i) => {
      write(letter, x + widths[i] / 2, 429, latinFont, '#fff1d8');
      x += widths[i] + gap;
    });
    ctx.restore();
  }

  const events = [
    ...cfg.lanterns.map((_, i) => [cue.lanterns + i * lampGap, () => {
      if (art.mid) sound('chime');
    }]),
    [cue.blades + .10, () => juice.screenFlash('#fff3da', .115)],
    [cue.impact, () => {
      juice.hitstop(impactHold);
      juice.shake(15, .29);
      juice.ring(center, 229, 216, gold, .45, 6);
      juice.ring(center, 229, 274, '#ff592f', .31, 4);
      for (const x of [center - 112, center + 112]) {
        juice.sparks(x, 270, 36, palette, 530);
        juice.confetti(x, 310, 32, [red, '#ee4b3d', '#f4a040'], 365);
      }
      sound('ult');
    }],
    ...title.map((_, i) => [glyphStart + i * glyphGap, () => {
      juice.shake(3.7, .13);
      juice.sparks(center + (i - (title.length - 1) / 2) * 82, 391, 11, palette, 130);
      sound('drum');
    }])
  ];

  function paint(time, ambient) {
    ctx.setTransform(artX, 0, 0, artY, 0, 0);
    ctx.fillStyle = backdrop;
    ctx.fillRect(0, 0, W, H);
    if (phase === 'entry') {
      imageLayer(art.bg, 1, .78);
      return;
    }

    const holdTime = time > cue.impact && time < cue.impact + impactHold ? cue.impact : time;
    ctx.save();
    juice.applyShake(ctx);
    scenery(holdTime < cue.latin ? holdTime : ambient);
    blades(time);
    ctx.save();
    if (ambient > cue.latin && !motion.matches) {
      const float = over(ambient, cue.latin, .4);
      ctx.translate(0, Math.sin(ambient * 3.1) * 3 * float);
    }
    emblem(time);
    banner(time);
    titles(time);
    ctx.restore();
    juice.drawParticles(ctx);
    ctx.restore();
    juice.drawFlash(ctx, W, H);
  }

  function frame(now, dt) {
    const elapsed = Math.max(0, (now - startAt) / 1000);
    if (phase === 'playing') {
      while (eventIndex < events.length && elapsed >= events[eventIndex][0]) {
        events[eventIndex++][1]();
      }
      if (elapsed >= cue.end) showEnd(now);
    }
    if (phase === 'waiting' && loaded) showEnd(now);
    if (phase === 'ready' && now - readyAt >= cfg.hold * 1000) beginExit(now);
    if (phase === 'exit') {
      if (motion.matches) {
        // 减少动态效果：保留简单淡出
        const faded = over(now, exitAt, 120);
        stage.style.opacity = 1 - faded;
        menuScreen.style.transform = ''; menuScreen.style.filter = '';
        if (faded >= 1) { finish(); return; }
        return;
      }
      const t = (now - exitAt) / 1000;
      if (!burstDone && t >= EXIT.charge) burst();
      // 主菜单从门后冲出来：放大、过曝 → 正常
      const m = ease(over(t, EXIT.charge, EXIT.total - EXIT.charge));
      menuScreen.style.transform = 'scale(' + (1.16 - .16 * m) + ')';
      menuScreen.style.filter = 'brightness(' + (1.9 - .9 * m) + ') saturate(' + (1.2 - .2 * m) + ')';
      juice.updateParticles(dt);
      exitPaint(t);
      if (t >= EXIT.total) { finish(); return; }
      return;
    }

    if (phase === 'entry') {
      if (entryDirty) {
        paint(0, 0);
        entryDirty = false;
      }
      return;
    }
    const time = phase === 'playing' ? elapsed : cue.end;
    const ambient = Math.max(time, elapsed);
    if (!motion.matches && ambient >= nextPetal) {
      juice.petal(W * (.72 + .23 * Math.random()), H * (.22 + .26 * Math.random()), '#cf2947');
      nextPetal = ambient + .48 + .36 * Math.random();
    }
    juice.updateParticles(dt);
    paint(time, ambient);
  }

  menuScreen.inert = true;
  resize();
  setPhase('entry', cfg.enter);
  action.addEventListener('click', activate);
  window.addEventListener('keydown', keydown, true);
  window.addEventListener('resize', resize);
  preload();
  window.TULOU_INTRO = { frame, get active() { return !stage.hidden; } };
})();
