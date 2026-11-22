/* 选关地图与过场。战斗、通关存档和 JUICE 时钟由 game.js 负责。 */
(function () {
  'use strict';

  const core = window.TULOU_CORE;
  const juice = window.JUICE;
  const data = window.GAME_DATA;
  const $ = (id) => document.getElementById(id);
  const root = $('level-map');
  if (!core || !juice || !root) return;

  const cfg = data.levelMap;
  const { W, H, levelProgress: progress } = core;
  const timing = cfg.timing;
  const world = $('level-map-world');
  const nodes = $('level-map-nodes');
  const fallback = $('level-list-fallback');
  const back = root.querySelector('.map-back');
  const info = $('map-info');
  const detail = $('map-info-stats');
  const play = $('map-play');
  const route = $('level-map-route');
  const fx = $('level-map-fx');
  const routeCtx = route.getContext('2d');
  const fxCtx = fx.getContext('2d');
  if (!routeCtx || !fxCtx) return;

  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const levels = [
    ...data.levels.map((level, index) => ({ ...level, index })),
    ...cfg.planned
  ];
  const total = levels.filter((level) => !level.hidden).length * cfg.stars.max;
  const span = (className, value = '') => {
    const element = document.createElement('span');
    element.className = className;
    element.textContent = value;
    return element;
  };
  const imageUrl = (name) => `url("${new URL('assets/images/' + name, document.baseURI).href}")`;
  const fill = (text, fields) => text.replace(/\{(\w+)\}/g, (match, key) => fields[key] ?? match);
  const xUnit = (x) => x * 100 / W + 'cqw';
  const sound = (name) => { if (core.Sound.on) juice.sfx(name); };
  const displayName = (level) => fill(cfg.stageTitle, level);
  const unlocked = (level) => progress.isUnlocked(level.index);
  const starText = (score) => {
    const count = core.clamp(Number(score?.stars) || 0, 0, cfg.stars.max);
    return cfg.star.repeat(count) + cfg.emptyStar.repeat(cfg.stars.max - count);
  };

  let opened = false;
  let startedAt = 0;
  let revealed = 0;
  let cursor = null;
  let selected = null;
  let launch = null;
  let stamp = null;
  let stamps = [];
  let nodesById = new Map();

  for (const canvas of [route, fx]) {
    canvas.width = W * 2;
    canvas.height = H * 2;
  }
  root.style.setProperty('--map-bg', imageUrl(cfg.background));
  root.style.setProperty('--map-pop-time', timing.pop + 'ms');
  root.style.setProperty('--map-stamp-time', timing.stamp + 'ms');
  $('map-title').textContent = cfg.title;
  $('map-total').setAttribute('aria-label', cfg.totalLabel);
  $('map-info-close').setAttribute('aria-label', cfg.close);
  play.textContent = cfg.play;
  back.textContent = cfg.back;

  function nodeFor(level, recommended) {
    const [x, y] = level.map;
    const canPlay = unlocked(level);
    const cleared = progress.isCleared(level.index);
    const score = progress.best(level.id);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'map-node';
    button.hidden = true;
    button.tabIndex = -1;
    button.dataset.levelId = level.id;
    button.style.left = x / W * 100 + '%';
    button.style.top = y / H * 100 + '%';

    if (level.hidden) {
      button.classList.add('is-secret');
      button.disabled = true;
      button.setAttribute('aria-label', cfg.secret);
      button.append(span('map-location-marker', cfg.mystery));
      return { level, button, canPlay };
    }

    button.classList.toggle('is-locked', !canPlay);
    button.classList.toggle('is-cleared', cleared);
    const status = cleared ? cfg.cleared : canPlay ? cfg.open : level.index === undefined ? cfg.future : cfg.locked;
    button.setAttribute('aria-label', displayName(level) + ' · ' + status);
    button.setAttribute('aria-controls', info.id);
    button.setAttribute('aria-expanded', 'false');

    const marker = span('map-location-marker');
    const thumb = span('map-thumb');
    const file = level.bg ?? cfg.background;
    if (core.getImg(file)) {
      thumb.style.backgroundImage = imageUrl(file);
      thumb.style.backgroundPosition = level.thumb.map((value) => value + '%').join(' ');
      thumb.classList.toggle('map-thumb-landmark', !level.bg);
    } else {
      thumb.textContent = level.name[0];
    }
    marker.append(thumb);
    const rim = span('map-rim');
    if (core.getImg(cfg.frame)) {
      rim.classList.add('has-art');
      rim.style.backgroundImage = imageUrl(cfg.frame);
    }
    marker.append(rim);
    if (!canPlay) {
      const lock = span('map-lock');
      lock.setAttribute('aria-hidden', 'true');
      marker.append(lock);
    }
    if (level === recommended) {
      const arrow = span('map-recommend');
      arrow.title = cfg.recommended;
      marker.append(arrow);
      button.setAttribute('aria-label', displayName(level) + ' · ' + cfg.recommended);
    }
    let seal = null;
    if (cleared) {
      seal = span('map-seal', cfg.sealText);
      seal.setAttribute('aria-hidden', 'true');
      if (core.getImg(cfg.seal)) {
        seal.style.backgroundImage = imageUrl(cfg.seal);
        seal.classList.add('has-art');
      }
      seal.hidden = progress.pendingSeal(level.id);
      marker.append(seal);
    }
    const caption = span('map-name', displayName(level));
    button.append(marker, caption);
    if (cleared) button.append(span('map-stars', starText(score)));
    if (!canPlay) button.append(span('map-note', status));

    const node = { level, button, canPlay, cleared, seal };
    button.addEventListener('pointerenter', (event) => {
      if (event.pointerType !== 'touch') showInfo(node);
    });
    button.addEventListener('click', () => {
      sound('click');
      showInfo(node);
    });
    return node;
  }

  function renderNodes() {
    const recommended = levels.find((level) => unlocked(level) && !progress.isCleared(level.index)) ??
      levels.findLast(unlocked);
    nodesById = new Map(levels.map((level) => [level.id, nodeFor(level, recommended)]));
    nodes.replaceChildren(...Array.from(nodesById.values(), (node) => node.button));
    cursor = nodesById.get(recommended?.id);
    stamps = [...nodesById.values()].filter((node) => node.seal?.hidden);
    const obtained = data.levels.reduce((sum, level) => {
      const stars = progress.best(level.id)?.stars ?? 0;
      return sum + core.clamp(Number(stars) || 0, 0, cfg.stars.max);
    }, 0);
    $('map-total').textContent = fill(cfg.totalStar, { stars: obtained, max: total });
  }

  function startMap() {
    const hadFocus = fallback.contains(document.activeElement);
    fallback.hidden = true;
    root.hidden = false;
    root.classList.toggle('is-unrolling', !reduced.matches);
    root.style.setProperty('--map-open', reduced.matches ? 1 : 0);
    startedAt = performance.now();
    revealed = 0;
    renderNodes();
    if (reduced.matches) revealNodes(Infinity);
    // A legacy fallback button can be focused while art is still loading.
    if (hadFocus) back.focus();
    sound('paper');
  }

  function open() {
    opened = true;
    if (core.getImg(cfg.background) && root.hidden) startMap();
  }

  function closeInfo() {
    if (selected) selected.button.setAttribute('aria-expanded', 'false');
    selected = null;
    info.hidden = true;
  }

  function close() {
    if (!opened) return;
    opened = false;
    if (!root.hidden) juice.clear();
    root.hidden = true;
    fallback.hidden = false;
    root.classList.remove('is-unrolling', 'is-launching');
    world.style.transform = '';
    root.style.setProperty('--map-dark', 0);
    closeInfo();
    launch = stamp = null;
    routeCtx.clearRect(0, 0, route.width, route.height);
    fxCtx.clearRect(0, 0, fx.width, fx.height);
  }

  function positionInfo() {
    if (!selected) return;
    const ratio = root.clientWidth / W;
    const [x, y] = selected.level.map.map((value) => value * ratio);
    const margin = 28 * ratio;
    const distance = 63 * ratio;
    const right = x + distance + info.offsetWidth <= root.clientWidth - margin;
    const left = right ? x + distance : x - info.offsetWidth - distance;
    info.style.left = core.clamp(left, margin, root.clientWidth - info.offsetWidth - margin) + 'px';
    info.style.top = core.clamp(y - info.offsetHeight * .29, 60 * ratio,
      root.clientHeight - info.offsetHeight - margin) + 'px';
  }

  function addStat(label, value) {
    const row = document.createElement('div');
    const key = document.createElement('dt');
    const text = document.createElement('dd');
    key.textContent = label;
    text.textContent = value;
    row.append(key, text);
    detail.append(row);
  }

  function setCursor(node) {
    if (cursor) cursor.button.tabIndex = -1;
    cursor = node;
    if (cursor && !cursor.button.hidden) cursor.button.tabIndex = 0;
  }

  function showInfo(node) {
    if (launch || node.button.hidden || node.level.hidden) return;
    if (node.canPlay) setCursor(node);
    if (node === selected) return;
    closeInfo();
    selected = node;
    node.button.setAttribute('aria-expanded', 'true');
    const level = node.level;
    $('map-info-stage').textContent = node.cleared ? cfg.cleared :
      node.canPlay ? cfg.open : level.index === undefined ? cfg.future : cfg.locked;
    $('map-info-title').textContent = displayName(level);
    $('map-info-story').textContent = level.subtitle;
    detail.replaceChildren();
    addStat(cfg.waveLabel, level.waves?.length ?? cfg.noWaves);
    const score = progress.best(level.id);
    addStat(cfg.bestLabel, score ? starText(score) + ' · ' + cfg.hpLabel + ' ' + score.hp + '/' + score.maxHp :
      node.cleared ? cfg.oldBest : cfg.noBest);
    if (score) addStat(cfg.killsLabel, score.kills);
    addStat(cfg.cardLabel, data.cards[level.card]?.title ?? cfg.noWaves);
    play.disabled = !node.canPlay;
    play.textContent = node.canPlay ? cfg.play : level.index === undefined ? cfg.future : cfg.locked;
    info.hidden = false;
    positionInfo();
  }

  function startBattle(node) {
    if (!node?.canPlay || !unlocked(node.level) || launch) return;
    sound('wave');
    if (reduced.matches) {
      core.newBattle(node.level.index);
      return;
    }
    launch = { node, at: performance.now() };
    root.classList.add('is-launching');
    const [x, y] = node.level.map;
    juice.shake(5, .26);
    juice.ring(x, y, 85, '#f5ba49', .42, 4);
  }

  function revealNodes(elapsed) {
    const entries = [...nodesById.values()];
    while (revealed < entries.length && elapsed >= timing.unfold + revealed * timing.nodeGap) {
      const node = entries[revealed++];
      node.button.hidden = false;
      if (node === cursor) node.button.tabIndex = 0;
      if (!reduced.matches && node.canPlay) sound('chime');
    }
  }

  function settleStamps(now, elapsed) {
    if (elapsed < timing.unfold + (nodesById.size - 1) * timing.nodeGap + timing.pop) return;
    if (!stamp && stamps.length) {
      const node = stamps.shift();
      node.seal.hidden = false;
      stamp = { node, at: now, landed: false };
      if (!reduced.matches) node.seal.classList.add('is-stamping');
    }
    if (!stamp) return;
    const progressMs = reduced.matches ? timing.stamp : now - stamp.at;
    if (!stamp.landed && progressMs >= timing.stamp * .62) {
      const { level } = stamp.node;
      stamp.landed = true;
      progress.markSealed(level.id);
      if (!reduced.matches) {
        const [x, y] = level.map;
        juice.shake(6, .26);
        juice.confetti(x + 26, y + 26, 22, ['#a51125', '#ce293d', '#f0ac73'], 245);
        sound('drum');
      }
    }
    if (progressMs >= timing.stamp) {
      stamp.node.seal.classList.remove('is-stamping');
      stamp = null;
    }
  }

  function drawRoutes(elapsed) {
    routeCtx.setTransform(2, 0, 0, 2, 0, 0);
    routeCtx.clearRect(0, 0, W, H);
    if (revealed === 0) return;
    for (const { from, to, control: [a, b] } of cfg.routes) {
      const start = nodesById.get(from);
      const end = nodesById.get(to);
      if (start.button.hidden || end.button.hidden) continue;
      const p = start.level.map;
      const q = end.level.map;
      const lit = start.canPlay && end.canPlay;
      routeCtx.beginPath();
      routeCtx.moveTo(...p);
      routeCtx.bezierCurveTo(...a, ...b, ...q);
      routeCtx.setLineDash([7, 8]);
      routeCtx.lineCap = 'round';
      routeCtx.lineWidth = 6;
      routeCtx.strokeStyle = lit ? '#ffecb8da' : '#e2d7b28c';
      routeCtx.stroke();
      routeCtx.lineWidth = 3.2;
      routeCtx.strokeStyle = lit ? '#ac2435' : '#63665dc4';
      routeCtx.stroke();
      routeCtx.setLineDash([]);
      if (!lit || reduced.matches) continue;
      routeCtx.fillStyle = '#fff0a1';
      routeCtx.shadowColor = '#e97813';
      routeCtx.shadowBlur = 9;
      for (let i = 0; i < 3; i++) {
        const t = (elapsed / 3600 + i / 3) % 1;
        const u = 1 - t;
        const point = (n) => u ** 3 * p[n] + 3 * u * u * t * a[n] + 3 * u * t * t * b[n] + t ** 3 * q[n];
        routeCtx.beginPath();
        routeCtx.arc(point(0), point(1), 2.8, 0, Math.PI * 2);
        routeCtx.fill();
      }
      routeCtx.shadowBlur = 0;
    }
    routeCtx.resetTransform();
  }

  function drawEffects(dt, zoom, offsetX, offsetY) {
    juice.updateParticles(dt);
    fxCtx.setTransform(1, 0, 0, 1, 0, 0);
    fxCtx.clearRect(0, 0, fx.width, fx.height);
    fxCtx.save();
    juice.applyShake(fxCtx);
    const { e, f } = fxCtx.getTransform();
    fxCtx.restore();
    fxCtx.setTransform(2, 0, 0, 2, 0, 0);
    juice.drawParticles(fxCtx);
    fxCtx.resetTransform();
    world.style.transform = (zoom !== 1 || e || f) ?
      `translate(${xUnit(offsetX + e)}, ${xUnit(offsetY + f)}) scale(${zoom})` : '';
  }

  function frame(now, dt) {
    const elapsed = now - startedAt;
    const spread = core.clamp(elapsed / timing.unfold, 0, 1);
    if (spread < 1 && !reduced.matches) {
      root.style.setProperty('--map-open', 1 - (1 - spread) ** 3);
    } else if (root.classList.contains('is-unrolling')) {
      root.classList.remove('is-unrolling');
      root.style.setProperty('--map-open', 1);
    }
    revealNodes(elapsed);
    if (!launch) settleStamps(now, elapsed);

    let zoom = 1;
    let offsetX = 0;
    let offsetY = 0;
    if (launch) {
      const travel = core.clamp((now - launch.at) / timing.launch, 0, 1);
      const movement = travel * (2 - travel);
      const [x, y] = launch.node.level.map;
      zoom = 1 + movement * 1.1;
      offsetX = (W / 2 - x) * movement * zoom;
      offsetY = (H / 2 - y) * movement * zoom;
      root.style.setProperty('--map-dark', travel);
      root.style.setProperty('--map-focus-x', (W / 2 + (x - W / 2) * zoom + offsetX) / W * 100 + '%');
      root.style.setProperty('--map-focus-y', (H / 2 + (y - H / 2) * zoom + offsetY) / H * 100 + '%');
      if (travel === 1) {
        core.newBattle(launch.node.level.index);
        return;
      }
    }
    drawRoutes(elapsed);
    drawEffects(dt, zoom, offsetX, offsetY);
  }

  play.addEventListener('click', () => startBattle(selected));
  $('map-info-close').addEventListener('click', () => {
    const button = selected?.button;
    closeInfo();
    button?.focus();
  });
  window.addEventListener('resize', positionInfo);
  root.addEventListener('click', (event) => {
    if (!event.target.closest('.map-node, #map-info, .map-toolbar')) closeInfo();
  });

  window.addEventListener('keydown', (event) => {
    if (!opened || window.TULOU_INTRO?.active) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      core.showScreen('menu');
      return;
    }
    if (root.hidden || launch) return;
    if (event.key.startsWith('Arrow')) {
      const choices = [...nodesById.values()].filter((node) => node.canPlay && !node.button.hidden);
      if (!choices.length) return;
      event.preventDefault();
      const direction = event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 1;
      const current = choices.indexOf(cursor);
      const next = current < 0 ? 0 : (current + direction + choices.length) % choices.length;
      showInfo(choices[next]);
      choices[next].button.focus();
    } else if (event.key === 'Enter' && !event.repeat) {
      if (event.target === play || event.target === back || event.target === $('map-info-close')) return;
      const node = [...nodesById.values()].find((item) => item.button === event.target) ?? selected ?? cursor;
      if (!node || node.button.hidden) return;
      event.preventDefault();
      if (node === selected) startBattle(node);
      else showInfo(node);
    }
  });

  window.TULOU_LEVELMAP = { open, close, frame, get active() { return opened && !root.hidden; } };
  core.loadImage(cfg.background).then((image) => {
    if (image && opened && root.hidden) startMap();
  });
  for (const file of [cfg.frame, cfg.seal]) {
    core.loadImage(file).then((image) => {
      if (!image || root.hidden) return;
      for (const node of nodesById.values()) {
        const element = file === cfg.frame ? node.button.querySelector('.map-rim') : node.seal;
        if (element) {
          element.style.backgroundImage = imageUrl(file);
          element.classList.add('has-art');
        }
      }
    });
  }
})();
