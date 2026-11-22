/* =========================================================
 * 《土楼争霸》打击感模块 JUICE
 * - 屏幕震动 shake / 顿帧 hitstop / 全屏闪光 flash
 * - 粒子：火花、红纸屑（鞭炮）、烟尘、金币飞向福币栏、伤害数字、飞出的"福"字
 * - 合成音效：没有 mp3 文件时，用 WebAudio 现场合成锣鼓、鞭炮、刀砍等声音
 * 单人闯关（game.js）和双人对决（versus.js）共用。
 * ========================================================= */
window.JUICE = (function () {
  'use strict';

  const cfg = {
    shake: true,        // 屏幕震动
    hitstop: true,      // 顿帧
    numbers: true,      // 伤害数字
    maxParticles: 450
  };

  /* ---------------- 震动 / 顿帧 / 闪光 ---------------- */
  let shakeAmp = 0, shakeT = 0, hitstopT = 0, flash = null;
  let sx = 0, sy = 0;

  function shake(amp, time) {
    if (!cfg.shake) return;
    shakeAmp = Math.max(shakeAmp, amp);
    shakeT = Math.max(shakeT, time || 0.22);
  }
  function hitstop(t) { if (cfg.hitstop) hitstopT = Math.max(hitstopT, t); }
  function screenFlash(color, t) { flash = { color, t, max: t }; }

  // 每帧调用：推进震动/顿帧计时，返回游戏逻辑该用的 dt（顿帧时为 0）
  function tick(dt) {
    if (shakeT > 0) {
      shakeT -= dt;
      const a = shakeAmp * Math.max(0, Math.min(1, shakeT / 0.22));
      sx = (Math.random() * 2 - 1) * a;
      sy = (Math.random() * 2 - 1) * a;
      if (shakeT <= 0) { shakeAmp = 0; sx = sy = 0; }
    }
    if (flash && (flash.t -= dt) <= 0) flash = null;
    if (hitstopT > 0) { hitstopT -= dt; return dt * 0.05; }
    return dt;
  }
  function applyShake(ctx) { if (sx || sy) ctx.translate(sx, sy); }
  function drawFlash(ctx, W, H) {
    if (!flash) return;
    ctx.globalAlpha = Math.max(0, flash.t / flash.max) * 0.55;
    ctx.fillStyle = flash.color; ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;
  }

  /* ---------------- 粒子 ---------------- */
  let parts = [];
  const R = (a, b) => a + Math.random() * (b - a);
  function add(p) { if (parts.length < cfg.maxParticles) parts.push(p); }

  // 火花：从命中点向外飞的亮线
  function sparks(x, y, n, colors, speed) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = R(0.4, 1) * (speed || 260);
      add({ k: 'spark', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 0, max: R(0.15, 0.35), c: colors[i % colors.length], w: R(1.5, 3) });
    }
  }
  // 红纸屑：鞭炮炸开后飘落的碎纸（闽南味！）
  function confetti(x, y, n, colors, power) {
    for (let i = 0; i < n; i++) {
      const a = R(-Math.PI, 0), v = R(80, power || 260);
      add({ k: 'chip', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, t: 0, max: R(0.6, 1.1),
        c: colors[i % colors.length], rot: R(0, 6), vr: R(-14, 14), s: R(3, 6) });
    }
  }
  function petal(x, y, color) {
    add({ k: 'petal', x, y, vx: R(-75, -38), vy: R(12, 32), t: 0, max: R(2.9, 4.2),
      c: color, rot: R(0, 6), vr: R(0.7, 2.2), s: R(3.5, 6.5) });
  }
  // 烟尘
  function dust(x, y, n, color) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = R(20, 70);
      add({ k: 'smoke', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.5, t: 0, max: R(0.35, 0.6), c: color || '#d8c7a3', r: R(5, 10) });
    }
  }
  // 冲击波圆环
  function ring(x, y, r, color, t, width) {
    add({ k: 'ring', x, y, r, c: color, t: 0, max: t || 0.3, w: width || 4 });
  }
  // 金币：先弹出来，再飞向福币栏
  function coins(x, y, n, tx, ty, onArrive) {
    for (let i = 0; i < n; i++) {
      add({ k: 'coin', x, y, vx: R(-120, 120), vy: R(-220, -120), t: 0, max: 3, tx, ty, delay: R(0.18, 0.32), onArrive: i === 0 ? onArrive : null });
    }
  }
  // 伤害数字
  function number(x, y, val, color, big) {
    if (!cfg.numbers) return;
    add({ k: 'num', x: x + R(-6, 6), y, vx: R(-30, 30), vy: big ? -170 : -120, t: 0, max: big ? 0.8 : 0.55,
      txt: String(Math.round(val)), c: color || '#fff', big: !!big });
  }
  // 飞出去的字（大招的"福"）
  function glyphs(x, y, n, txt, color) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + R(-0.2, 0.2), v = R(220, 420);
      add({ k: 'glyph', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 0, max: R(0.7, 1.0), txt, c: color, rot: R(-1, 1), vr: R(-4, 4), s: R(22, 36) });
    }
  }
  // 升级：金色星点往上飘
  function sparkleUp(x, y, n) {
    for (let i = 0; i < n; i++) {
      add({ k: 'star', x: x + R(-22, 22), y: y + R(-10, 20), vx: R(-15, 15), vy: R(-140, -70), t: 0, max: R(0.5, 0.9), s: R(2, 4) });
    }
  }

  function updateParticles(dt) {
    for (const p of parts) {
      p.t += dt;
      switch (p.k) {
        case 'spark': p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.9; p.vy *= 0.9; break;
        case 'chip': p.vy += 520 * dt; p.vx *= 0.97; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt; break;
        case 'petal': p.x += p.vx * dt; p.y += (p.vy + 16 * Math.sin(p.rot)) * dt; p.rot += p.vr * dt; break;
        case 'smoke': p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.92; p.vy *= 0.92; break;
        case 'num': p.vy += 300 * dt; p.x += p.vx * dt; p.y += p.vy * dt; break;
        case 'glyph': p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.93; p.vy *= 0.93; p.rot += p.vr * dt; break;
        case 'star': p.x += p.vx * dt; p.y += p.vy * dt; break;
        case 'coin':
          if (p.t < p.delay) { p.vy += 600 * dt; p.x += p.vx * dt; p.y += p.vy * dt; }
          else {
            const dx = p.tx - p.x, dy = p.ty - p.y, d = Math.hypot(dx, dy);
            const sp = 300 + (p.t - p.delay) * 1800;
            if (d < sp * dt + 6) { p.t = p.max; if (p.onArrive) p.onArrive(); }
            else { p.x += dx / d * sp * dt; p.y += dy / d * sp * dt; }
          }
          break;
      }
    }
    parts = parts.filter((p) => p.t < p.max);
  }

  function drawParticles(ctx) {
    for (const p of parts) {
      const k = p.t / p.max, a = 1 - k;
      switch (p.k) {
        case 'spark':
          ctx.globalAlpha = a; ctx.strokeStyle = p.c; ctx.lineWidth = p.w; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 0.05, p.y - p.vy * 0.05); ctx.stroke();
          break;
        case 'chip':
          ctx.globalAlpha = Math.min(1, a * 1.5);
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.scale(1, Math.abs(Math.cos(p.rot * 1.3)) + 0.2);
          ctx.fillStyle = p.c; ctx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s * 0.7); ctx.restore();
          break;
        case 'petal':
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
          ctx.globalAlpha = Math.min(p.t * 3, a * 1.5, 0.8);
          ctx.fillStyle = p.c; ctx.beginPath(); ctx.ellipse(0, 0, p.s, p.s * 0.46, 0, 0, 7); ctx.fill();
          ctx.restore();
          break;
        case 'smoke':
          ctx.globalAlpha = a * 0.6; ctx.fillStyle = p.c;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (1 + k * 1.5), 0, 7); ctx.fill();
          break;
        case 'ring':
          ctx.globalAlpha = a; ctx.strokeStyle = p.c; ctx.lineWidth = p.w * a + 1;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (0.3 + k * 0.9), 0, 7); ctx.stroke();
          break;
        case 'coin': {
          ctx.globalAlpha = 1;
          const s = 1 + Math.sin(p.t * 20) * 0.25;
          ctx.fillStyle = '#c8102e'; ctx.beginPath(); ctx.ellipse(p.x, p.y, 6 * s, 6, 0, 0, 7); ctx.fill();
          ctx.fillStyle = '#ffd34d'; ctx.beginPath(); ctx.ellipse(p.x, p.y, 4.2 * s, 4.2, 0, 0, 7); ctx.fill();
          break;
        }
        case 'num': {
          const pop = k < 0.15 ? 1 + (0.15 - k) * 4 : 1;
          ctx.globalAlpha = k > 0.7 ? (1 - k) / 0.3 : 1;
          ctx.font = `bold ${Math.round((p.big ? 22 : 14) * pop)}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.lineWidth = p.big ? 4 : 3; ctx.strokeStyle = '#000b'; ctx.strokeText(p.txt, p.x, p.y);
          ctx.fillStyle = p.c; ctx.fillText(p.txt, p.x, p.y);
          break;
        }
        case 'glyph':
          ctx.globalAlpha = a; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
          ctx.font = `bold ${p.s}px "KaiTi", serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillStyle = p.c; ctx.fillText(p.txt, 0, 0); ctx.restore();
          break;
        case 'star':
          ctx.globalAlpha = a; ctx.fillStyle = '#fff3c4';
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.t * 6);
          ctx.fillRect(-p.s, -p.s / 3, p.s * 2, p.s / 1.5); ctx.fillRect(-p.s / 3, -p.s, p.s / 1.5, p.s * 2);
          ctx.restore();
          break;
      }
    }
    ctx.globalAlpha = 1;
  }
  function clear() { parts = []; shakeAmp = shakeT = hitstopT = 0; sx = sy = 0; flash = null; }

  /* =========================================================
   * 合成音效（WebAudio）—— assets/sfx 里没有 mp3 时自动使用
   * ========================================================= */
  let ac = null, master = null, noiseBuf = null;
  const lastPlay = {};
  function audio() {
    if (ac) return ac;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ac = new AC();
      master = ac.createGain(); master.gain.value = 0.32; master.connect(ac.destination);
      noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    } catch (e) { ac = null; }
    return ac;
  }
  function unlock() {
    const a = audio();
    if (!a || a.state === 'running') return Promise.resolve(!!a);
    return a.resume().then(() => a.state === 'running', () => false);
  }
  // 浏览器要求用户点过页面后才能出声
  ['pointerdown', 'keydown', 'touchstart'].forEach((ev) =>
    window.addEventListener(ev, unlock, { passive: true }));

  function env(g, t0, peak, attack, decay) {
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + decay);
  }
  function tone(freq, type, t0, peak, attack, decay, freqEnd) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t0);
    if (freqEnd) o.frequency.exponentialRampToValueAtTime(freqEnd, t0 + attack + decay);
    env(g, t0, peak, attack, decay);
    o.connect(g); g.connect(master);
    o.start(t0); o.stop(t0 + attack + decay + 0.05);
  }
  function noise(t0, peak, attack, decay, filterType, freq, q, freqEnd) {
    const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = noiseBuf; s.loop = true;
    f.type = filterType || 'bandpass'; f.frequency.setValueAtTime(freq || 1000, t0); f.Q.value = q || 1;
    if (freqEnd) f.frequency.exponentialRampToValueAtTime(freqEnd, t0 + attack + decay);
    env(g, t0, peak, attack, decay);
    s.connect(f); f.connect(g); g.connect(master);
    s.start(t0, Math.random() * 0.5); s.stop(t0 + attack + decay + 0.05);
  }
  const PENTA = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.7, 1318.5]; // 五声音阶

  const SFX = {
    click(t) { tone(1400, 'square', t, 0.08, 0.002, 0.03); },
    place(t) { tone(820, 'sine', t, 0.5, 0.002, 0.08, 500); tone(410, 'triangle', t, 0.3, 0.002, 0.1); noise(t, 0.2, 0.002, 0.06, 'lowpass', 600); },   // 木鱼"笃"
    hit(t) { noise(t, 0.55, 0.001, 0.07, 'bandpass', 2400, 1.2, 900); tone(160, 'sine', t, 0.6, 0.002, 0.09, 60); },   // 刀砍
    fan(t) { noise(t, 0.18, 0.02, 0.14, 'bandpass', 600, 2, 2400); },   // 扇风呼
    throw(t) { tone(900, 'triangle', t, 0.1, 0.002, 0.05, 1300); },
    boom(t) {   // 鞭炮噼里啪啦
      tone(90, 'sine', t, 0.7, 0.002, 0.18, 40);
      for (let i = 0; i < 6; i++) { const tt = t + i * 0.035 + Math.random() * 0.02; noise(tt, 0.5, 0.001, 0.03, 'highpass', 1800 + Math.random() * 1500, 0.7); }
    },
    kill(t) { tone(1760, 'sine', t, 0.18, 0.002, 0.12); tone(2637, 'sine', t + 0.04, 0.12, 0.002, 0.15); },   // 叮——金币
    bigkill(t) { tone(110, 'sine', t, 0.8, 0.002, 0.3, 45); noise(t, 0.4, 0.002, 0.25, 'lowpass', 500); SFX.kill(t + 0.05); },
    upgrade(t) { [0, 2, 4, 5].forEach((n, i) => tone(PENTA[n], 'triangle', t + i * 0.06, 0.25, 0.005, 0.18)); },
    leak(t) { tone(140, 'sawtooth', t, 0.35, 0.005, 0.25, 70); noise(t, 0.3, 0.002, 0.2, 'lowpass', 400); },
    wave(t) {   // 锣
      [220, 331, 467, 612].forEach((f, i) => tone(f, 'sine', t, 0.35 / (i + 1), 0.005, 1.4, f * 0.97));
      noise(t, 0.2, 0.002, 0.3, 'bandpass', 900, 0.8);
    },
    ult(t) {   // 大锣 + 鼓点 + 五声上行
      [110, 166, 233, 308, 415].forEach((f, i) => tone(f, 'sine', t, 0.6 / (i + 1), 0.004, 2.2, f * 0.96));
      noise(t, 0.5, 0.002, 0.6, 'bandpass', 700, 0.6);
      for (let i = 0; i < 4; i++) { tone(95, 'sine', t + 0.12 * i, 0.6, 0.002, 0.14, 45); }
      PENTA.slice(2).forEach((f, i) => tone(f, 'triangle', t + 0.15 + i * 0.05, 0.16, 0.005, 0.25));
    },
    card(t) { [0, 2, 4, 7].forEach((n, i) => tone(PENTA[n], 'sine', t + i * 0.09, 0.22, 0.005, 0.35)); },
    win(t) { [0, 2, 4, 3, 5, 7].forEach((n, i) => tone(PENTA[n], 'triangle', t + i * 0.12, 0.25, 0.005, 0.4)); SFX.wave(t + 0.75); },
    lose(t) { [4, 3, 2, 0].forEach((n, i) => tone(PENTA[n] / 2, 'triangle', t + i * 0.18, 0.25, 0.01, 0.4)); }
  };
  const MIN_GAP = { hit: 0.05, fan: 0.07, throw: 0.06, boom: 0.06, kill: 0.04, click: 0.03 };
  const UI_SFX = {
    chime(t) {
      tone(1318, 'sine', t, 0.1, 0.003, 0.15);
      tone(2637, 'sine', t, 0.035, 0.002, 0.115);
    },
    drum(t) {
      tone(138, 'sine', t, 0.55, 0.002, 0.15, 48);
      noise(t, 0.22, 0.002, 0.06, 'lowpass', 390);
    },
    paper(t) {
      noise(t, 0.29, 0.03, 0.32, 'bandpass', 910, 0.75, 2800);
      noise(t + 0.09, 0.13, 0.02, 0.25, 'bandpass', 3500, 1.4, 1600);
    }
  };

  function sfx(name) {
    const a = audio();
    const play = SFX[name] || UI_SFX[name];
    if (!a || a.state !== 'running' || !play) return;
    const now = a.currentTime;
    if (lastPlay[name] && now - lastPlay[name] < (MIN_GAP[name] || 0.02)) return;
    lastPlay[name] = now;
    try { play(now + 0.005); } catch (e) { /* 忽略 */ }
  }

  return {
    cfg, shake, hitstop, screenFlash, tick, applyShake, drawFlash,
    sparks, confetti, petal, dust, ring, coins, number, glyphs, sparkleUp,
    updateParticles, drawParticles, clear, sfx, unlock,
    count: () => parts.length,
    SFX_NAMES: Object.keys(SFX)
  };
})();
