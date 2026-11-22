/* 《土楼争霸》元宵灯会主菜单。战斗与音效状态仍由 game.js 管理。 */
(function () {
  'use strict';

  const core = window.TULOU_CORE;
  const juice = window.JUICE;
  const screen = document.getElementById('screen-menu');
  const scene = document.getElementById('menu-scene');
  const legacy = document.getElementById('menu-text-buttons');
  if (!core || !juice || !screen || !scene || !legacy) return;

  const ART_WIDTH = 1920;
  const ART_HEIGHT = 1080;
  const CLICK_DELAY = 250;
  const SIZE = 100 / ART_WIDTH;
  const soundButton = document.getElementById('btn-sound');
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const scaleUnit = (value) => (value * SIZE) + 'cqw';
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const layout = [
    { key: 'tulou', label: '开始游戏', pivot: [1120, 325], action: () => core.showScreen('levels') },
    { key: 'flags', label: '双人对决', pivot: [575, 780], action: () => window.VS.open() },
    { key: 'stage', label: '玩法说明', pivot: [1140, 705], action: () => core.showScreen('help') },
    { key: 'scroll', label: window.GAME_DATA.gallery.title, pivot: [1660, 855], action: () => core.showScreen('gallery') },
    { key: 'lantern', label: '音效', pivot: [202, 458], action: () => soundButton.click() }
  ];

  // PNG silhouettes are exported from the same alphas as the 1920×1080 art.
  // Local-file images taint canvases in Chromium. These data URLs let the
  // exact same alpha test run when the player double-clicks index.html.
  const localMasks = {"tulou":{"rect":[766,189,700,262],"png":"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"},"flags":{"rect":[330,538,494,438],"png":"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"},"stage":{"rect":[845,522,582,399],"png":"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"},"scroll":{"rect":[1405,654,505,390],"png":"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"},"lantern":{"rect":[86,438,242,429],"png":"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"}};
  const plateRects = [[1004, 448, 235, 70], [446, 916, 310, 96], [981, 875, 349, 91], [1509, 916, 312, 91], [36, 870, 294, 92]];
  const startPlate = {
    rect: plateRects[0],
    png: 'iVBORw0KGgoAAAANSUhEUgAAAOsAAABGCAYAAAAtiGPlAAABOElEQVR42u3aOxKCQBBAQXeK+195jSRAUH7CTNkdGRCg1NsR2NZ7fwCjVxAt24mFawNvoU4/Lx176aQbDnwZ+Kd4z2qiXTFZhQrXLACHYhUq3BxsCBVqBBtChRrBhlChRrAhVKgRbAgVagQbQoUawdrBBEWCDVMVagQbQoUawYZQoQb3rFBkuooVTFZArCBWQKyAWEGsgFgBsYJYAbECYgWxAmIFxApiBcQKiBXECogVxAqIFRAriBUQKyBWECsgVkCsIFZArIBYQayAWAGxglgBsYJYAbECYgWxAmIF9sTa/AyQUpubrIKFxKFO/wYLFpKGOnfPKlhIGOrSAybBQrJQPz0NFiwkCvXbqxvBQpJQ17xnFSwkCHXtpgjBws2hbtnBJFi4MdSt2w0FC+dEuqul4derAXCOJ+LpIogLJbamAAAAAElFTkSuQmCC'
  };

  const layers = [
    ['sky', 0], ['clouds', 5], ['far', 7], ['mid', 12], ['tulou', 9],
    ['flags', 17], ['stage', 17], ['puppets', 17], ['scroll', 19], ['lantern', 12], ['fg', 27]
  ];
  const visuals = new Map();
  const items = new Map();
  const gateGlow = document.createElement('span');
  gateGlow.className = 'menu-entry-gate';
  gateGlow.setAttribute('aria-hidden', 'true');
  const keyboard = document.createElement('div');
  keyboard.className = 'menu-objects';
  const fx = document.createElement('canvas');
  fx.className = 'menu-fx';
  fx.width = core.W * 2;
  fx.height = core.H * 2;
  fx.setAttribute('aria-hidden', 'true');
  const fxContext = fx.getContext('2d');
  if (!fxContext) return;
  fxContext.scale(2, 2);
  const textToggle = document.createElement('button');
  textToggle.className = 'menu-text-toggle';
  textToggle.type = 'button';
  textToggle.textContent = '☰ 文字菜单';
  textToggle.setAttribute('aria-controls', legacy.id);
  textToggle.setAttribute('aria-expanded', 'false');

  let ready = false;
  let textOpen = false;
  let hovered = null;
  let focused = null;
  let pressed = null;
  let pending = 0;
  let time = 0;
  let fireflyAt = 3;
  let targetX = 0;
  let targetY = 0;
  let driftX = 0;
  let driftY = 0;
  let listening = false;
  let lastSound = core.Sound.on;
  let pointerWasTouch = false;

  const isActive = () => ready && !screen.classList.contains('hidden');
  const canAim = () => isActive() && !textOpen;
  const uiSound = () => { if (core.Sound.on) juice.sfx('click'); };

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.alt = '';
      image.decoding = 'async';
      image.draggable = false;
      image.onload = () => image.decode().then(() => resolve(image), reject);
      image.onerror = () => reject(new Error('Menu image unavailable: ' + src));
      image.src = src;
    });
  }

  async function readAlpha({ rect: [x, y, width, height], png }, art) {
    const testCanvas = document.createElement('canvas');
    testCanvas.width = width;
    testCanvas.height = height;
    const ctx = testCanvas.getContext('2d', { willReadFrequently: true });
    let rgba;
    if (location.protocol !== 'file:') {
      ctx.drawImage(art, -x, -y);
      try { rgba = ctx.getImageData(0, 0, width, height).data; }
      catch (error) {
        if (error.name !== 'SecurityError') throw error;
        testCanvas.width = width;
      }
    }
    if (!rgba) {
      const mask = await loadImage('data:image/png;base64,' + png);
      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(mask, 0, 0);
      rgba = ctx.getImageData(0, 0, width, height).data;
    }
    const alpha = new Uint8Array(width * height);
    for (let i = 0; i < alpha.length; i++) alpha[i] = rgba[i * 4 + 3];
    return { x, y, width, height, alpha };
  }

  function artPoint(event) {
    const bounds = scene.getBoundingClientRect();
    return {
      x: (event.clientX - bounds.left) * ART_WIDTH / bounds.width,
      y: (event.clientY - bounds.top) * ART_HEIGHT / bounds.height
    };
  }

  function opaquePixel(mask, x, y) {
    const px = Math.floor(x - mask.x);
    const py = Math.floor(y - mask.y);
    return px >= 0 && py >= 0 && px < mask.width && py < mask.height &&
      mask.alpha[py * mask.width + px] > 20;
  }

  function opaqueAt(item, point) {
    const { pivot, pose, mask } = item;
    const x = point.x - pose.x - pivot[0];
    const y = point.y - pose.y - pivot[1];
    const cos = Math.cos(pose.angle);
    const sin = Math.sin(pose.angle);
    return opaquePixel(mask,
      (cos * x + sin * y) / pose.zoom + pivot[0],
      (-sin * x + cos * y) / pose.zoom + pivot[1]);
  }

  function pick(point, event) {
    if (event?.pointerType === 'touch') {
      for (const item of items.values()) {
        const bounds = item.button.getBoundingClientRect();
        const dx = event.clientX - (bounds.left + bounds.width / 2);
        const dy = event.clientY - (bounds.top + bounds.height / 2);
        if (Math.abs(dx) <= Math.max(22, bounds.width / 2) &&
            Math.abs(dy) <= Math.max(22, bounds.height / 2)) return item;
      }
    }
    const start = items.get('tulou');
    const plate = start.plate;
    if (opaquePixel(plate.mask,
      (point.x - start.pose.x - plate.left) / plate.zoomX + plate.mask.x,
      (point.y - start.pose.y - plate.top) / plate.zoomY + plate.mask.y)) return start;
    for (let i = layers.length - 1; i >= 0; i--) {
      const item = items.get(layers[i][0]);
      if (item && opaqueAt(item, point)) return item;
    }
    return null;
  }

  function syncHighlights() {
    const highlighted = pressed || hovered || focused;
    for (const item of items.values()) {
      const glowing = item === highlighted;
      item.image.classList.toggle('is-lit', glowing);
      item.button.classList.toggle('is-lit', glowing);
    }
    scene.classList.toggle('has-hit', !!(hovered || pressed));
    scene.classList.toggle('is-guiding', !highlighted && !textOpen && !pending);
  }

  function setHovered(item) {
    if (hovered === item) return;
    hovered = item;
    if (hovered) uiSound();
    syncHighlights();
  }

  function syncSound() {
    lastSound = core.Sound.on;
    const lantern = items.get('lantern');
    if (!lantern) return;
    lantern.image.classList.toggle('is-muted', !lastSound);
    lantern.button.setAttribute('aria-pressed', String(lastSound));
    lantern.button.setAttribute('aria-label', lastSound ? '音效，已开启' : '音效，已静音');
  }

  function setTextOpen(open) {
    textOpen = open;
    textToggle.setAttribute('aria-expanded', String(open));
    legacy.classList.toggle('hidden', !open);
    keyboard.inert = open;
    hovered = focused = pressed = null;
    if (open) targetX = targetY = 0;
    syncHighlights();
  }

  function activate(item, point) {
    if (!canAim() || pending) return;
    item.bounceUntil = time + CLICK_DELAY / 1000;
    const x = point.x * core.W / ART_WIDTH;
    const y = point.y * core.H / ART_HEIGHT;
    if (!motion.matches) {
      juice.confetti(x, y, 8, ['#c8102e', '#f34a42', '#d4a017'], 155);
      juice.sparks(x, y, 6, ['#ffd34d', '#fff3c4', '#f45c37'], 185);
    }
    uiSound();
    pending = window.setTimeout(() => {
      pending = 0;
      pressed = null;
      if (!canAim()) return;
      item.action();
      syncSound();
      syncHighlights();
    }, CLICK_DELAY);
    syncHighlights();
  }

  function addItem(config, mask, index, plateMask) {
    const [x, y, width, height] = plateRects[index];
    const item = {
      ...config, mask, image: visuals.get(config.key), button: document.createElement('button'),
      pose: { x: 0, y: 0, angle: 0, zoom: 1 }, bounceUntil: 0
    };
    const button = item.button;
    button.type = 'button';
    button.className = 'menu-object';
    button.dataset.menuItem = item.key;
    button.textContent = item.label;
    const [zoomX, zoomY] = plateMask ? [1.72, 1.27] : [1, 1];
    const left = x + width * (1 - zoomX) / 2;
    const top = y + height * (1 - zoomY) / 2;
    if (plateMask) {
      item.plate = { mask: plateMask, left, top, zoomX, zoomY };
      button.style.backgroundSize = scaleUnit(ART_WIDTH * zoomX) + ' ' + scaleUnit(ART_HEIGHT * zoomY);
    }
    button.style.left = scaleUnit(left);
    button.style.top = scaleUnit(top);
    button.style.width = scaleUnit(width * zoomX);
    button.style.height = scaleUnit(height * zoomY);
    button.style.backgroundPosition = scaleUnit(-x * zoomX) + ' ' + scaleUnit(-y * zoomY);
    button.addEventListener('focus', () => {
      focused = item;
      if (button.matches(':focus-visible')) {
        hovered = null;
        uiSound();
      }
      syncHighlights();
    });
    button.addEventListener('blur', () => {
      if (focused === item) focused = null;
      syncHighlights();
    });
    button.addEventListener('click', () => activate(item, { x: item.pivot[0], y: item.pivot[1] }));
    items.set(item.key, item);
    keyboard.appendChild(button);
  }

  function installEvents() {
    scene.addEventListener('pointermove', (event) => {
      if (!canAim() || event.pointerType === 'touch' || event.target === textToggle) return;
      pointerWasTouch = false;
      const point = artPoint(event);
      targetX = clamp(point.x / ART_WIDTH * 2 - 1, -1, 1);
      targetY = clamp(point.y / ART_HEIGHT * 2 - 1, -1, 1);
      setHovered(pick(point));
    });
    scene.addEventListener('pointerleave', () => {
      targetX = targetY = 0;
      setHovered(null);
    });
    scene.addEventListener('pointerdown', (event) => {
      if (!canAim() || pending || event.button !== 0 || event.target === textToggle) return;
      const point = artPoint(event);
      pointerWasTouch = event.pointerType === 'touch';
      pressed = pick(point, event);
      if (!pressed) return;
      if (pointerWasTouch) uiSound();
      scene.setPointerCapture(event.pointerId);
      syncHighlights();
    });
    const release = () => {
      pressed = null;
      if (pointerWasTouch) hovered = null;
      syncHighlights();
    };
    scene.addEventListener('pointercancel', release);
    scene.addEventListener('lostpointercapture', release);
    scene.addEventListener('pointerup', (event) => {
      if (!pressed) return;
      const point = artPoint(event);
      const item = pressed;
      release();
      if (pick(point, event) === item) activate(item, point);
    });
    textToggle.addEventListener('pointerenter', () => setHovered(null));
    textToggle.addEventListener('click', () => {
      if (pending) return;
      uiSound();
      setTextOpen(!textOpen);
    });
    screen.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && textOpen) {
        setTextOpen(false);
        textToggle.focus();
      }
    });
  }

  function placeVisual(image, pose, pivot) {
    const translate = (x, y) => 'translate(' + scaleUnit(x) + ', ' + scaleUnit(y) + ')';
    const offset = translate(pose.x, pose.y);
    image.style.transform = pivot ? offset + ' ' + translate(...pivot) +
      ' rotate(' + pose.angle + 'rad) scale(' + pose.zoom + ') ' +
      translate(-pivot[0], -pivot[1]) : offset;
  }

  function frame(dt) {
    if (!isActive()) return;
    if (!listening) {
      listening = true;
      syncSound();
    }
    if (lastSound !== core.Sound.on) syncSound();
    time += dt;
    const reduced = motion.matches;
    const ease = Math.min(1, dt * 8);
    driftX = reduced ? 0 : driftX + (targetX - driftX) * ease;
    driftY = reduced ? 0 : driftY + (targetY - driftY) * ease;

    const highlighted = pressed || hovered || focused;
    for (const [key, depth] of layers) {
      const image = visuals.get(key);
      const item = items.get(key);
      const anchor = item || (key === 'puppets' ? items.get('stage') : null);
      if (key === 'puppets') {
        const pose = { ...anchor.pose, y: anchor.pose.y + (reduced ? 0 : Math.sin(time * 2.5) * 3) };
        placeVisual(image, pose, anchor.pivot);
      } else if (anchor) {
        const pose = anchor.pose;
        pose.x = -driftX * depth;
        pose.y = -driftY * depth * 0.58;
        pose.angle = key === 'lantern' && !reduced ? Math.sin(time * 1.7) * 0.035 : 0;
        const progress = clamp((anchor.bounceUntil - time) * 1000 / CLICK_DELAY, 0, 1);
        const bounce = progress && !reduced ? Math.sin(2 * Math.PI * progress) * progress * 0.09 : 0;
        const targetZoom = (highlighted === anchor ? 1.05 : 1) + bounce;
        pose.zoom += (targetZoom - pose.zoom) * (reduced ? 1 : Math.min(1, dt * 22));
        placeVisual(image, pose, anchor.pivot);
        if (key === 'tulou') placeVisual(gateGlow, pose);
        anchor.button.style.transform = 'translate(' + scaleUnit(pose.x) + ', ' + scaleUnit(pose.y) + ')';
      } else {
        const cloud = key === 'clouds' && !reduced ? Math.sin(time * 0.12) * 16 : 0;
        placeVisual(image, { x: -driftX * depth + cloud, y: -driftY * depth * 0.58 });
      }
    }

    if (!reduced && time >= fireflyAt) {
      juice.sparkleUp(430 + Math.random() * 340, 305 + Math.random() * 135, 2);
      fireflyAt = time + 3 + Math.random() * 3;
    }
    juice.updateParticles(dt);
    fxContext.clearRect(0, 0, core.W, core.H);
    juice.drawParticles(fxContext);
  }

  function reset() {
    if (pending) window.clearTimeout(pending);
    pending = 0;
    listening = false;
    targetX = targetY = driftX = driftY = 0;
    fxContext.clearRect(0, 0, core.W, core.H);
    if (ready) setTextOpen(false);
  }

  const visibility = new MutationObserver(() => {
    if (screen.classList.contains('hidden')) reset();
  });
  visibility.observe(screen, { attributes: true, attributeFilter: ['class'] });

  const artLoads = new Map([...layers.map(([name]) => name), 'plaques'].map((name) => [
    name, core.loadImage('menu/menu_' + name + '.png')
  ]));

  async function init() {
    const loaded = await Promise.all([...artLoads].map(async ([name, pendingImage]) => {
      const image = await pendingImage;
      if (!image || image.naturalWidth !== ART_WIDTH || image.naturalHeight !== ART_HEIGHT) throw new Error('Menu layer unavailable');
      image.alt = '';
      image.draggable = false;
      await image.decode();
      return [name, image];
    }));
    for (const [name, image] of loaded) visuals.set(name, image);
    const masks = await Promise.all([
      ...layout.map((item) => readAlpha(localMasks[item.key], visuals.get(item.key))),
      readAlpha(startPlate, visuals.get('plaques'))
    ]);

    for (const [name] of layers) {
      const image = visuals.get(name);
      image.className = 'menu-art-image';
      image.dataset.menuVisual = name;
      image.setAttribute('aria-hidden', 'true');
      scene.appendChild(image);
      if (name === 'tulou') scene.appendChild(gateGlow);
    }
    layout.forEach((item, index) => addItem(item, masks[index], index, item.key === 'tulou' ? masks[layout.length] : null));
    scene.append(keyboard, fx, textToggle);
    installEvents();
    syncSound();
    ready = true;
    setTextOpen(false);
    screen.classList.add('menu-ready');
    scene.hidden = false;
  }

  const menuReady = init().catch(() => {
    ready = false;
    scene.hidden = true;
    legacy.classList.remove('hidden');
    screen.classList.remove('menu-ready');
  });
  window.TULOU_MENU = { frame, ready: menuReady, artLoads: [...artLoads.values()], get active() { return isActive(); } };
})();

