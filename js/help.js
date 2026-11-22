/* 布袋戏台教学。示范只绘制画面，战斗与技能数值来自 GAME_DATA。 */
(function () {
  'use strict';

  const core = window.TULOU_CORE;
  const data = window.GAME_DATA;
  const juice = window.JUICE;
  const cfg = data.help;
  const $ = (id) => document.getElementById(id);
  const screen = $('screen-help');
  const opening = $('help-opening');
  const tablist = $('help-tabs');
  const page = $('help-page');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const [demoWidth, demoHeight] = cfg.demo.size;
  const heroes = cfg.heroKeys.map((key) => data.heroes[key]);
  const enemies = cfg.enemyKeys.map((key) => data.enemies[key]);
  const demoContexts = [];
  const mint = '#fff3be';
  const gold = '#ffd166';
  const dark = '#562c23';
  const fill = (text, fields) => text.replace(/\{(\w+)\}/g, (match, key) => fields[key] ?? match);
  const sound = (name) => { if (core.Sound.on) juice.sfx(name); };

  let active = false;
  let index = 0;
  let elapsed = 0;
  let previousParts = [];
  let swipe = null;
  let flip = null;

  function element(tag, className = '', value = '') {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (value !== '') node.textContent = value;
    return node;
  }

  function art(target, file, placeholder = '') {
    if (placeholder) target.textContent = placeholder;
    core.loadImage(file).then((image) => {
      if (!image) return;
      target.style.backgroundImage = `url("${image.src}")`;
      target.textContent = '';
      target.classList.add('has-art');
    });
  }

  $('help-title').textContent = cfg.title;
  $('help-try').textContent = cfg.tryIt;
  screen.querySelector('.map-back').textContent = data.levelMap.back;
  opening.style.setProperty('--help-curtain-ms', cfg.curtainMs + 'ms');
  art($('help-stage-art'), cfg.stage);
  screen.querySelectorAll('.help-curtain').forEach((curtain, i) => art(curtain, cfg.curtains[i]));
  core.loadImage(cfg.towerArt);

  function canvasFor(width, height, className) {
    const canvas = element('canvas', className);
    canvas.width = width * 2;
    canvas.height = height * 2;
    canvas.setAttribute('aria-hidden', 'true');
    const ctx = canvas.getContext('2d');
    ctx?.scale(2, 2);
    return [canvas, ctx];
  }

  function basicPage() {
    const grid = element('div', 'help-basic-grid');
    cfg.basics.forEach((step, ii) => {
      const tile = element('article', 'help-basic');
      const [canvas, ctx] = canvasFor(demoWidth, demoHeight, 'help-demo');
      demoContexts.push(ctx);
      const title = element('h4');
      title.append(element('span', 'help-step', String(ii + 1)), document.createTextNode(step.title));
      tile.append(canvas, title, element('p', '', fill(step.text, { need: data.ult.need })));
      grid.append(tile);
    });
    return grid;
  }

  function statValue(number) {
    return Number(number.toFixed(2)).toString();
  }

  function statsRow(label, value, sample, max) {
    const row = element('div');
    row.append(element('dt', '', label), element('dd', '', value));
    if (max !== undefined) {
      const meter = element('meter');
      meter.max = Math.max(1, max);
      meter.value = sample;
      meter.setAttribute('aria-label', label);
      row.append(meter);
    }
    return row;
  }

  function unitTile(unit) {
    const tile = element('article', 'help-unit');
    const figure = element('div', 'help-unit-art');
    figure.style.setProperty('--help-unit-color', unit.color);
    art(figure, unit.img, unit.short || unit.name[0]);
    tile.append(figure, element('h4', '', unit.name));
    return tile;
  }

  function heroPage() {
    const grid = element('div', 'help-unit-grid');
    const attributes = heroes.map((unit) => [unit.dmg, unit.range, 1 / unit.rate]);
    const maxima = cfg.stats.map((_, i) => Math.max(...attributes.map((row) => row[i])));
    heroes.forEach((unit, i) => {
      const tile = unitTile(unit);
      const stats = element('dl', 'help-stats');
      const values = attributes[i];
      cfg.stats.forEach((label, j) => {
        const value = statValue(values[j]);
        stats.append(statsRow(label, j === 2 ? fill(cfg.hitsPerSecond, { value }) : value, values[j], maxima[j]));
      });
      tile.append(element('p', 'help-cost', fill(cfg.cost, { value: unit.cost })),
        element('p', 'help-skill', unit.desc), stats);
      grid.append(tile);
    });
    return grid;
  }

  function enemyPage() {
    const grid = element('div', 'help-unit-grid help-enemies');
    enemies.forEach((unit, i) => {
      const tile = unitTile(unit);
      const stats = element('dl', 'help-stats');
      const values = [unit.hp, fill(cfg.speed, { value: unit.speed }), fill(cfg.cost, { value: unit.reward })];
      cfg.enemyStats.forEach((label, j) => stats.append(statsRow(label, values[j])));
      tile.append(stats, element('p', 'help-skill', cfg.tips[cfg.enemyKeys[i]]));
      grid.append(tile);
    });
    return grid;
  }

  function circle(ctx, x, y, r, color) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  }

  function inkText(ctx, text, x, y, size, color) {
    ctx.font = `bold ${size}px "Microsoft YaHei", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
  }

  function sprite(ctx, unit, x, y, size) {
    const image = core.getImg(unit.img);
    if (image) ctx.drawImage(image, x - size / 2, y - size / 2, size, size);
    else {
      circle(ctx, x, y, size * .32, unit.color);
      inkText(ctx, unit.short || unit.name[0], x, y, size * .32, '#fff1ce');
    }
  }

  function drawVersus(ctx) {
    if (!ctx) return;
    ctx.clearRect(0, 0, 340, 174);
    const { laneNames, teams } = data.versus;
    const colors = [teams.L.color, teams.R.color];
    laneNames.forEach((label, i) => {
      const y = 44 + i * 37;
      ctx.beginPath();
      ctx.moveTo(53, 80);
      ctx.bezierCurveTo(96, y, 245, y, 287, 80);
      ctx.strokeStyle = '#b98c58';
      ctx.lineWidth = 2.2;
      ctx.stroke();
      const centerY = .75 * y + 20;
      inkText(ctx, label, 170, centerY - 8, 11, dark);
      for (const [n, x, direction] of [[0, 121, 1], [1, 218, -1]]) {
        ctx.beginPath();
        ctx.moveTo(x + 8 * direction, centerY);
        ctx.lineTo(x - 5 * direction, centerY - 4);
        ctx.lineTo(x - 5 * direction, centerY + 4);
        ctx.closePath();
        ctx.fillStyle = colors[n];
        ctx.fill();
      }
    });
    for (const [side, x] of [['L', 41], ['R', 299]]) {
      circle(ctx, x, 80, 28, teams[side].color);
      sprite(ctx, { img: cfg.towerArt, name: teams[side].name, color: teams[side].color }, x, 77, 49);
      inkText(ctx, teams[side].name, x, 120, 14, dark);
    }
  }

  function versusPage() {
    const body = element('div', 'help-match');
    const [canvas, ctx] = canvasFor(340, 174, 'help-match-map');
    canvas.removeAttribute('aria-hidden');
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', cfg.diagram);
    drawVersus(ctx);
    core.loadImage(cfg.towerArt).then(() => drawVersus(ctx));
    const rules = element('div', 'help-match-rules');
    const V = data.versus;
    cfg.match.forEach((rule) => {
      const row = element('article');
      row.append(element('h4', '', rule.title), element('p', '', fill(rule.text, {
        lanes: V.lanes.length, minutes: V.duration / 60, overtime: V.overtime
      })));
      rules.append(row);
    });
    body.append(canvas, rules);
    return body;
  }

  function keysPage() {
    const body = element('div', 'help-keys');
    const board = element('div', 'help-key-diagram');
    board.setAttribute('aria-hidden', 'true');
    const bindings = new Map();
    for (const side of ['L', 'R']) {
      for (const [keys] of cfg.keys[side]) {
        for (const key of keys) bindings.set(key, side);
      }
    }
    for (const keys of cfg.keyboard) {
      const row = element('div');
      for (const key of keys) {
        const cap = element('kbd', bindings.has(key) ? 'side-' + bindings.get(key) : '', key);
        if (key === '空格') cap.classList.add('space');
        row.append(cap);
      }
      board.append(row);
    }
    const keyboard = element('div', 'help-keyboard');
    for (const side of ['L', 'R']) {
      const half = element('section', 'help-key-side side-' + side);
      half.append(element('h4', '', data.versus.teams[side].name));
      cfg.keys[side].forEach(([keys, description]) => {
        const row = element('div', 'help-key-row');
        const set = element('div', 'help-key-set');
        keys.forEach((key) => set.append(element('kbd', '', key)));
        row.append(set, element('span', '', description));
        half.append(row);
      });
      keyboard.append(half);
    }
    body.append(board, keyboard, element('p', 'help-touch', cfg.touch));
    return body;
  }

  const panels = [basicPage, heroPage, enemyPage, versusPage, keysPage].map((build, i) => {
    const panel = element('div', 'help-content');
    panel.append(element('h3', '', cfg.pages[i]), build());
    return panel;
  });
  const tabs = cfg.pages.map((name, i) => {
    const tab = element('button', 'help-tab', name);
    tab.type = 'button';
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-controls', page.id);
    tab.id = 'help-tab-' + i;
    tab.addEventListener('click', () => select(i));
    return tab;
  });
  tablist.append(...tabs);

  function select(target, animate = true) {
    const next = (target + tabs.length) % tabs.length;
    if (animate && next === index) return;
    const direction = next >= index ? 1 : -1;
    index = next;
    elapsed = 0;
    previousParts = [];
    flip?.cancel();
    juice.clear();
    page.replaceChildren(panels[next]);
    page.scrollTop = 0;
    page.setAttribute('aria-labelledby', tabs[next].id);
    tabs.forEach((tab, i) => {
      tab.setAttribute('aria-selected', String(i === next));
      tab.tabIndex = i === next ? 0 : -1;
    });
    if (index === 0) drawDemos(0);
    if (!animate) return;
    sound('paper');
    if (!reduced.matches) {
      flip = page.animate([
        { opacity: .42, transform: `perspective(700px) rotateY(${direction * 22}deg) translateX(${direction * 9}px)` },
        { opacity: 1, transform: 'perspective(700px) rotateY(0)' }
      ], { duration: cfg.pageMs, easing: 'ease-out' });
    }
  }

  function stone(ctx, x, y) {
    ctx.beginPath();
    ctx.ellipse(x, y + 4, 29, 9, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#65574e';
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x, y, 29, 9, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#a99c83';
    ctx.fill();
    ctx.strokeStyle = '#e2d3ad';
    ctx.stroke();
  }

  function demoPick(ctx, p) {
    const chosen = Math.min(heroes.length - 1, Math.floor(p * heroes.length));
    heroes.forEach((hero, i) => {
      const x = 15 + i * 51;
      ctx.fillStyle = '#743d31';
      ctx.fillRect(x, 18, 46, 69);
      ctx.strokeStyle = i === chosen ? gold : '#a56a4f';
      ctx.lineWidth = i === chosen ? 3 : 1;
      ctx.strokeRect(x, 18, 46, 69);
      sprite(ctx, hero, x + 23, 52, i === chosen ? 54 : 48);
    });
    ctx.beginPath();
    const x = 38 + chosen * 51;
    ctx.moveTo(x - 6, 9); ctx.lineTo(x + 6, 9); ctx.lineTo(x, 17);
    ctx.fillStyle = gold;
    ctx.fill();
  }

  function demoPlace(ctx, p) {
    stone(ctx, 87, 82);
    const fall = Math.min(1, p / .44);
    sprite(ctx, heroes[0], 87, 54 - 42 * (1 - fall) ** 2, 68);
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#ffdb7a90';
    ctx.beginPath(); ctx.ellipse(87, 82, 35 + 9 * fall, 11 + 3 * fall, 0, 0, Math.PI * 2); ctx.stroke();
  }

  function demoUpgrade(ctx, p) {
    stone(ctx, 49, 84);
    const strike = Math.max(0, 1 - Math.abs(p - .45) * 8);
    sprite(ctx, heroes[1], 49 + 10 * strike, 57, 62);
    inkText(ctx, p < .32 ? '★' : '★★', 49, 15, 15, gold);
    if (p < .75) {
      ctx.save();
      const defeated = Math.max(0, (p - .57) / .18);
      ctx.translate(147 - p * 29, 68);
      ctx.rotate(defeated * 1.25);
      ctx.globalAlpha = 1 - defeated;
      sprite(ctx, enemies[0], 0, 0, 42);
      ctx.restore();
    }
  }

  function demoSpecial(ctx, p) {
    const power = Math.min(1, p / .64);
    ctx.fillStyle = '#482620';
    ctx.fillRect(30, 11, 116, 11);
    ctx.fillStyle = gold;
    ctx.fillRect(31, 12, 114 * power, 9);
    sprite(ctx, heroes[2], 88, 67, 68);
    for (const x of [39, 138]) {
      ctx.globalAlpha = Math.max(.21, 1 - Math.max(0, p - .68) * 3);
      sprite(ctx, enemies[1], x, 72, 38);
    }
    ctx.globalAlpha = 1;
  }

  const demos = [demoPick, demoPlace, demoUpgrade, demoSpecial];
  function drawDemos(dt) {
    elapsed += dt;
    for (const [i, ctx] of demoContexts.entries()) {
      if (!ctx) continue;
      const p = reduced.matches ? .69 : (elapsed + cfg.demo.offsets[i]) / cfg.demo.period % 1;
      const x = i * demoWidth;
      const prev = previousParts[i] ?? p;
      if (!reduced.matches) {
        if (i === 1 && prev < .44 && p >= .44) juice.dust(x + 87, 82, 5, '#e6c89c');
        if (i === 2 && prev < .59 && p >= .59) {
          juice.sparks(x + 121, 65, 8, [mint, gold], 95);
          juice.coins(x + 120, 64, 2, x + 152, 14);
        }
        if (i === 3 && prev < .66 && p >= .66) {
          juice.ring(x + 88, 65, 68, gold, .44, 3);
          juice.glyphs(x + 88, 65, 4, cfg.seal, gold);
        }
      }
      previousParts[i] = p;
      ctx.clearRect(0, 0, demoWidth, demoHeight);
      demos[i](ctx, p);
      ctx.save();
      ctx.translate(-x, 0);
      juice.drawParticles(ctx);
      ctx.restore();
    }
    if (dt) juice.updateParticles(dt);
  }

  function open() {
    if (active) return;
    active = true;
    select(0, false);
    screen.classList.add('is-help-open');
    sound('wave');
  }

  function close() {
    if (!active) return;
    active = false;
    swipe = null;
    flip?.cancel();
    screen.classList.remove('is-help-open');
    juice.clear();
  }

  window.addEventListener('keydown', (event) => {
    if (!active) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      core.showScreen('menu');
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      const fromTab = tablist.contains(document.activeElement);
      select(index + (event.key === 'ArrowLeft' ? -1 : 1));
      if (fromTab) tabs[index].focus();
    }
  });
  opening.addEventListener('pointerdown', (event) => {
    if (event.pointerType !== 'touch') return;
    swipe = { x: event.clientX, y: event.clientY, pointer: event.pointerId };
    opening.setPointerCapture(event.pointerId);
  });
  opening.addEventListener('pointerup', (event) => {
    if (swipe?.pointer !== event.pointerId) return;
    const dx = event.clientX - swipe.x;
    const dy = event.clientY - swipe.y;
    swipe = null;
    if (Math.abs(dx) >= cfg.swipe && Math.abs(dx) > Math.abs(dy) * 1.35) select(index + (dx < 0 ? 1 : -1));
  });
  opening.addEventListener('pointercancel', () => { swipe = null; });
  window.TULOU_HELP = { open, close, frame: (dt) => { if (index === 0) drawDemos(dt); }, get active() { return active; } };
})();
