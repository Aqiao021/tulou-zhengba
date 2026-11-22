/* 电竞福签：从结算数据绘制并导出竖版 PNG。 */
(function () {
  'use strict';

  const data = window.GAME_DATA;
  const config = data.fortune;
  const core = window.TULOU_CORE;
  const juice = window.JUICE;
  const byId = (id) => document.getElementById(id);
  const dialog = byId('fortune-preview');
  const preview = byId('fortune-image');
  const download = byId('fortune-download');
  const fx = byId('fortune-confetti');
  const fxContext = fx.getContext('2d');
  const serif = '"KaiTi", "STKaiti", "Microsoft YaHei", serif';
  const sans = '"Microsoft YaHei", "PingFang SC", sans-serif';
  const ink = '#f9e1a3';
  const gold = '#ddb05a';
  const formatNumber = new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 0 });
  const format = (template, fields) => template.replace(/\{(\w+)\}/g, (tag, key) => fields[key] ?? tag);
  let photoUrl = '';
  let busy = false;
  let offlineArt;

  fx.width = core.W;
  fx.height = core.H;
  byId('fortune-heading').textContent = config.title;
  byId('fortune-close').textContent = config.close;
  byId('fortune-touch-hint').textContent = config.touchHint;
  download.textContent = config.download;
  preview.alt = config.title;

  function bestTower(towers) {
    let winner = null;
    for (const tower of towers) {
      if (tower.hero && tower.damage > (winner?.damage ?? 0)) {
        winner = { key: tower.hero, damage: tower.damage };
      }
    }
    return winner;
  }

  function soloResult() {
    const game = window.TULOU.G;
    if (!game?.over) return null;
    return {
      mvp: bestTower(game.towers),
      rows: [
        [config.level, game.L.name],
        [config.kills, formatNumber.format(game.kills)],
        [config.hp, game.hp + ' / ' + game.maxHp],
        [config.outcome, game.win ? config.cleared : config.lost]
      ]
    };
  }

  function versusResult() {
    const match = window.VS.S;
    if (!match?.over) return null;
    const teams = ['L', 'R'].map((side) => {
      const player = match.P[side];
      return {
        name: player.team.name, kills: player.stats.kills, sent: player.stats.sent,
        mvp: bestTower(player.towers)
      };
    });
    const mvp = teams[1].mvp?.damage > (teams[0].mvp?.damage ?? 0) ? teams[1].mvp : teams[0].mvp;
    return { teams, mvp, winner: match.winner ? match.P[match.winner].team.name : null };
  }

  function loadImage(src) {
    return new Promise((resolve) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => resolve(null);
      image.src = src;
    });
  }

  function loadOfflineArt() {
    if (!offlineArt) {
      offlineArt = new Promise((resolve) => {
        const script = document.createElement('script');
        script.src = config.offlineArt;
        script.onload = () => resolve(window.TULOU_FORTUNE_ART ?? {});
        script.onerror = () => resolve({});
        document.head.append(script);
      });
    }
    return offlineArt;
  }

  async function imageForPoster(filename, key) {
    const original = await loadImage('assets/images/' + filename);
    if (!original || location.protocol !== 'file:') return original;
    // The shipped artwork is packed as export-safe data URLs for file:// Canvas.
    const art = await loadOfflineArt();
    return art[key] ? loadImage(art[key]) : null;
  }

  function drawFit(ctx, image, x, y, width, height) {
    const scale = Math.min(width / image.naturalWidth, height / image.naturalHeight);
    const w = image.naturalWidth * scale;
    const h = image.naturalHeight * scale;
    ctx.drawImage(image, x + (width - w) / 2, y + (height - h) / 2, w, h);
  }

  function write(ctx, value, x, y, size, {
    color = ink, align = 'center', font = serif, width
  } = {}) {
    ctx.fillStyle = color;
    ctx.font = 'bold ' + size + 'px ' + font;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    if (width) ctx.fillText(value, x, y, width);
    else ctx.fillText(value, x, y);
  }

  function line(ctx, x1, y1, x2, y2, color, width = 2) {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  function petal(ctx, x, y, rotation, length, breadth) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(length * .37, -breadth, length, 0);
    ctx.quadraticCurveTo(length * .37, breadth, 0, 0);
    ctx.fill();
    ctx.restore();
  }

  function corner(ctx, x, y, turnX, turnY) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(turnX, turnY);
    ctx.fillStyle = '#e5ac50';
    for (let angle = 0; angle <= 4; angle++) petal(ctx, 0, 0, angle * Math.PI / 8, 76 - angle % 2 * 12, 18);
    ctx.fillStyle = '#a82b39';
    for (let angle = 0; angle <= 4; angle++) petal(ctx, 6, 6, angle * Math.PI / 8, 43, 7);
    ctx.restore();
  }

  function paintFrame(ctx) {
    const bg = ctx.createLinearGradient(0, 0, 780, 1920);
    bg.addColorStop(0, '#8e132d');
    bg.addColorStop(.52, '#ae1d31');
    bg.addColorStop(1, '#500e24');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 1080, 1920);

    ctx.strokeStyle = '#d18d4f';
    ctx.lineWidth = 3;
    ctx.strokeRect(36, 36, 1008, 1848);
    ctx.strokeStyle = '#efbd68a0';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(57, 57, 966, 1806);
    corner(ctx, 59, 59, 1, 1);
    corner(ctx, 1021, 59, -1, 1);
    corner(ctx, 59, 1861, 1, -1);
    corner(ctx, 1021, 1861, -1, -1);

    ctx.fillStyle = '#db925784';
    for (let y = 162; y < 1810; y += 53) {
      petal(ctx, 46, y, Math.PI / 2, 19, 9);
      petal(ctx, 1034, y, Math.PI / 2, 19, 9);
    }
  }

  function paintMedallion(ctx) {
    const centerY = 631;
    const halo = ctx.createRadialGradient(540, centerY, 42, 540, centerY, 365);
    halo.addColorStop(0, '#f1ad575f');
    halo.addColorStop(1, '#f1ad5700');
    ctx.fillStyle = halo;
    ctx.fillRect(155, 275, 770, 720);
    for (const radius of [254, 273]) {
      ctx.beginPath();
      ctx.arc(540, centerY, radius, 0, Math.PI * 2);
      ctx.strokeStyle = radius === 273 ? '#f6c06e6b' : '#f6c06e30';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.fillStyle = '#edb05b8a';
    for (let i = 0; i < 24; i++) {
      const angle = i * Math.PI / 12;
      petal(ctx, 540 + 263 * Math.cos(angle), centerY + 263 * Math.sin(angle), angle, 22, 10);
    }
  }

  function paintPlaceholder(ctx, hero) {
    ctx.save();
    ctx.translate(540, 653);
    ctx.fillStyle = hero?.color || '#78172b';
    ctx.strokeStyle = gold;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(-87, -5);
    ctx.quadraticCurveTo(-147, 21, -161, 87);
    ctx.lineTo(-173, 167);
    ctx.quadraticCurveTo(0, 205, 173, 167);
    ctx.lineTo(161, 87);
    ctx.quadraticCurveTo(147, 21, 87, -5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, -78, 112, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    write(ctx, hero?.short || config.stamp, 0, -70, 112);
    ctx.restore();
  }

  function paintSoloStats(ctx, rows) {
    rows.forEach(([label, value], i) => {
      const y = 1128 + i * 103;
      write(ctx, label, 158, y, 37, { align: 'left', color: gold });
      write(ctx, value, 922, y, 43, { align: 'right', width: 385 });
      if (i < rows.length - 1) line(ctx, 158, y + 47, 922, y + 47, '#d1946358');
    });
  }

  function paintVersusStats(ctx, result) {
    const [left, right] = result.teams;
    write(ctx, format(config.duel, { left: left.name, right: right.name }), 540, 1090, 54);
    write(ctx, result.winner ? format(config.winner, { team: result.winner }) : config.draw,
      540, 1159, 40, { color: gold });
    line(ctx, 166, 1201, 914, 1201, '#e2a65475');
    line(ctx, 540, 1235, 540, 1510, '#e2a65470');

    result.teams.forEach((team, index) => {
      const x = index === 0 ? 324 : 756;
      const accent = index === 0 ? '#ffabae' : '#ffe099';
      write(ctx, team.name, x, 1248, 43, { color: accent });
      write(ctx, config.kills + ' ' + formatNumber.format(team.kills), x, 1320, 35, { font: sans });
      write(ctx, config.sent + ' ' + formatNumber.format(team.sent), x, 1375, 35, { font: sans });
      const name = team.mvp ? format(config.teamMvp, { hero: data.heroes[team.mvp.key].name }) : config.noTeamMvp;
      write(ctx, name, x, 1452, 37, { color: accent, width: 370 });
      if (team.mvp) {
        write(ctx, format(config.damage, { damage: formatNumber.format(team.mvp.damage) }),
          x, 1503, 28, { width: 370 });
      }
    });
  }

  function paintPoster(canvas, result, logo, footerLogo, portrait, blessing, date) {
    const ctx = canvas.getContext('2d');
    ctx.scale(canvas.width / 1080, canvas.height / 1920);
    ctx.imageSmoothingQuality = 'high';
    paintFrame(ctx);
    if (logo) drawFit(ctx, logo, 202, 73, 676, 202);
    else write(ctx, config.game, 540, 179, 108, { color: gold });
    line(ctx, 194, 324, 347, 324, gold);
    line(ctx, 733, 324, 886, 324, gold);
    write(ctx, config.title, 540, 324, 57);

    paintMedallion(ctx);
    const hero = result.mvp && data.heroes[result.mvp.key];
    if (portrait) drawFit(ctx, portrait, 234, 365, 612, 514);
    else paintPlaceholder(ctx, hero);
    const mvpLine = hero ? format(config.mvp, { hero: hero.name, damage: formatNumber.format(result.mvp.damage) }) : config.noMvp;
    write(ctx, mvpLine, 540, 949, 48, { width: 896 });

    ctx.fillStyle = '#521022b5';
    ctx.fillRect(104, 1026, 872, 518);
    ctx.strokeStyle = '#d99e58';
    ctx.lineWidth = 2;
    ctx.strokeRect(104, 1026, 872, 518);
    if (result.teams) paintVersusStats(ctx, result);
    else paintSoloStats(ctx, result.rows);

    write(ctx, blessing, 540, 1634, 55, { color: '#ffe6a9', width: 892 });
    line(ctx, 274, 1706, 806, 1706, '#efbd6ca0');
    if (footerLogo) drawFit(ctx, footerLogo, 112, 1720, 136, 136);
    write(ctx, config.signature, 540, 1767, 33, { color: '#eac582', width: 590 });
    write(ctx, date, 540, 1823, 27, { color: '#eac582', font: sans });
    ctx.save();
    ctx.translate(914, 1788);
    ctx.rotate(-.13);
    ctx.fillStyle = '#c8102e';
    ctx.fillRect(-50, -50, 100, 100);
    ctx.strokeStyle = '#ecc485';
    ctx.lineWidth = 3;
    ctx.strokeRect(-50, -50, 100, 100);
    ctx.strokeRect(-43, -43, 86, 86);
    write(ctx, config.stamp, 0, 3, 67);
    ctx.restore();
  }

  function today() {
    const date = new Date();
    return [date.getFullYear(), date.getMonth() + 1, date.getDate()].map((n) => String(n).padStart(2, '0')).join('-');
  }

  function clearPreview() {
    if (photoUrl) URL.revokeObjectURL(photoUrl);
    photoUrl = '';
    preview.removeAttribute('src');
    download.removeAttribute('href');
  }

  async function showFortune(button, result) {
    if (busy || dialog.open || !result) return;
    busy = true;
    button.disabled = true;
    button.textContent = config.generating;
    let label = config.button;
    try {
      const hero = result.mvp && data.heroes[result.mvp.key];
      const [logo, footerLogo, portrait] = await Promise.all([
        imageForPoster(config.logo, 'logo'),
        imageForPoster(config.footerLogo, 'round'),
        hero ? imageForPoster(hero.img, result.mvp.key) : null
      ]);
      const canvas = document.createElement('canvas');
      canvas.width = config.width;
      canvas.height = config.height;
      const date = today();
      paintPoster(canvas, result, logo, footerLogo, portrait, core.rand(data.blessings), date);
      const png = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (!png) throw new Error('Empty PNG');
      if (button.closest('.screen').classList.contains('hidden')) return;

      photoUrl = URL.createObjectURL(png);
      preview.src = photoUrl;
      await preview.decode();
      if (button.closest('.screen').classList.contains('hidden')) {
        clearPreview();
        return;
      }

      download.href = photoUrl;
      download.download = format(config.filename, { date });
      dialog.showModal();
      juice.clear();
      if (core.Sound.on) juice.sfx('card');
      if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        const colors = ['#c8102e', '#f8cf6f', '#ff9561', '#fff0bb'];
        juice.confetti(core.W * .2, core.H * .35, 22, colors, 200);
        juice.confetti(core.W * .8, core.H * .35, 22, colors, 200);
      }
    } catch (error) {
      clearPreview();
      label = config.failed;
    } finally {
      button.disabled = false;
      button.textContent = label;
      busy = false;
    }
  }

  for (const [id, result] of [['btn-fortune-single', soloResult], ['btn-fortune-versus', versusResult]]) {
    const button = byId(id);
    button.textContent = config.button;
    button.addEventListener('click', () => showFortune(button, result()));
  }

  byId('fortune-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => {
    clearPreview();
    juice.clear();
    fxContext.clearRect(0, 0, core.W, core.H);
  });

  window.TULOU_FORTUNE = {
    get open() { return dialog.open; },
    frame(dt) {
      if (!juice.count()) return;
      juice.updateParticles(dt);
      fxContext.clearRect(0, 0, core.W, core.H);
      juice.drawParticles(fxContext);
    }
  };
})();

