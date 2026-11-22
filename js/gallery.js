/* 闽南藏宝阁。解锁和已读状态由 game.js 保存。 */
(function () {
  'use strict';

  const core = window.TULOU_CORE;
  const data = window.GAME_DATA;
  const juice = window.JUICE;
  const $ = (id) => document.getElementById(id);
  const screen = $('screen-gallery');
  const list = $('gallery-list');
  const overlay = $('gallery-overlay');
  const detail = $('gallery-detail');
  const closeButton = $('gallery-close');
  const prev = $('gallery-prev');
  const next = $('gallery-next');
  const speak = $('gallery-speak');
  const toolbar = $('gallery-toolbar');
  const fx = $('gallery-fx');
  const ctx = fx.getContext('2d');
  const { W, H, collection } = core;
  const cfg = data.gallery;
  const timings = cfg.timings;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const cards = Object.entries(data.cards);
  const levels = [...data.levels, ...data.levelMap.planned];
  const speech = typeof window.SpeechSynthesisUtterance === 'function' ? window.speechSynthesis : null;
  const buttonByKey = new Map();

  let active = false;
  let unlocked = [];
  let selected = '';
  let opener = null;
  let flight = null;
  let turns = [];
  let swipe = null;
  let speaking = null;
  let celebrateAt = Infinity;

  const sound = (name) => { if (core.Sound.on) juice.sfx(name); };
  const imageURL = (name) => `url("${new URL('assets/images/' + name, document.baseURI).href}")`;
  const ms = (value) => value + 'ms';
  function putArt(element, file, current = () => true) {
    core.loadImage(file).then((image) => {
      if (!image || !current()) return;
      element.style.backgroundImage = imageURL(file);
      element.classList.add('has-art');
    });
  }

  fx.width = W * 2;
  fx.height = H * 2;
  $('gallery-title').textContent = cfg.title;
  $('gallery-award').textContent = cfg.award;
  toolbar.querySelector('button').textContent = data.levelMap.back;
  closeButton.setAttribute('aria-label', cfg.close);
  prev.textContent = cfg.prev;
  next.textContent = cfg.next;
  speak.textContent = cfg.speak;
  speak.hidden = !speech;
  screen.style.setProperty('--shelf-light-ms', ms(timings.light));
  screen.style.setProperty('--shelf-fly-ms', ms(timings.fly));
  putArt($('gallery-backdrop'), cfg.background);
  core.loadImage(cfg.backArt);

  for (const [index, [x, y]] of cfg.lanterns.entries()) {
    const lantern = document.createElement('i');
    lantern.className = 'gallery-glow';
    lantern.style.left = x * 100 / W + '%';
    lantern.style.top = y * 100 / H + '%';
    lantern.style.animationDelay = ms(90 + index * timings.lanternGap);
    $('gallery-lanterns').append(lantern);
  }

  function tilt(event) {
    if (reduced.matches || event.pointerType === 'touch') return;
    const button = event.currentTarget;
    const bounds = button.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width - .5;
    const y = (event.clientY - bounds.top) / bounds.height - .5;
    button.style.setProperty('--tilt-x', -y * 18 + 'deg');
    button.style.setProperty('--tilt-y', x * 18 + 'deg');
  }

  function createCard([key, card], index) {
    const [x, y] = cfg.slots[index];
    const got = collection.has(key);
    const item = document.createElement('div');
    item.className = 'gallery-item';
    item.style.left = x * 100 / W + '%';
    item.style.top = y * 100 / H + '%';
    item.style.setProperty('--shelf-card-delay', ms(timings.cards + index * timings.cardGap));

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'gallery-card';
    button.dataset.card = key;
    button.disabled = !got;
    button.setAttribute('aria-label', got ? card.title : cfg.locked + ' · ' + card.unlock);
    const cover = document.createElement('span');
    cover.className = 'gallery-cover';
    if (got) {
      const title = document.createElement('strong');
      title.textContent = card.title;
      cover.textContent = card.title[0];
      putArt(cover, card.img);
      button.append(cover, title);
      if (collection.fresh(key)) {
        const badge = document.createElement('span');
        badge.className = 'gallery-new';
        badge.textContent = cfg.newBadge;
        button.append(badge);
      }
      button.addEventListener('pointermove', tilt);
      button.addEventListener('pointerleave', () => {
        button.style.removeProperty('--tilt-x');
        button.style.removeProperty('--tilt-y');
      });
      button.addEventListener('click', () => openDetail(key, button));
    } else {
      cover.textContent = cfg.seal;
      putArt(cover, cfg.backArt);
      const lock = document.createElement('span');
      lock.className = 'gallery-lock map-lock';
      lock.setAttribute('aria-hidden', 'true');
      button.append(cover, lock);
      const note = document.createElement('p');
      note.className = 'gallery-condition';
      note.textContent = card.unlock;
      item.append(note);
    }
    item.prepend(button);
    buttonByKey.set(key, button);
    return item;
  }

  function open() {
    if (active) return;
    active = true;
    unlocked = cards.map(([key]) => key).filter(collection.has);
    list.replaceChildren(...cards.map(createCard));
    const count = unlocked.length;
    $('gallery-count').textContent = cfg.count.replace('{count}', count).replace('{total}', cards.length);
    const progress = $('gallery-progress');
    progress.max = cards.length;
    progress.value = count;
    $('gallery-award').hidden = count !== cards.length;
    if (count === cards.length) celebrateAt = performance.now() + (reduced.matches ? 0 : timings.cards + cards.length * timings.cardGap);
    screen.classList.add('is-lighting');
    sound('card');
  }

  function stopReading() {
    if (!speaking) return;
    speaking = null;
    speech.cancel();
    speak.textContent = cfg.speak;
  }

  function fillDetail(key) {
    stopReading();
    selected = key;
    const card = data.cards[key];
    collection.view(key);
    buttonByKey.get(key).querySelector('.gallery-new')?.remove();
    $('gallery-detail-title').textContent = card.title;
    $('gallery-detail-text').textContent = card.text;
    const level = levels.find((entry) => entry.card === key);
    $('gallery-detail-related').textContent = cfg.related + ' · ' + (level?.name ?? cfg.anyLevel);
    $('gallery-detail-source').textContent = cfg.source + ' · ' +
      (card.source ?? (card.text.includes('【待核实') ? cfg.pending : cfg.unlisted));
    const art = $('gallery-detail-art');
    art.style.backgroundImage = '';
    art.classList.remove('has-art');
    art.setAttribute('aria-label', card.title);
    art.textContent = card.title[0];
    putArt(art, card.img, () => selected === key && !overlay.hidden);
    prev.disabled = next.disabled = unlocked.length < 2;
  }

  function stopMotion() {
    for (const animation of turns) animation.cancel();
    turns = [];
    flight?.remove();
    flight = null;
  }

  function openDetail(key, button) {
    if (selected || !collection.has(key)) return;
    opener = button;
    overlay.hidden = false;
    list.inert = toolbar.inert = true;
    fillDetail(key);
    closeButton.focus();
    sound('paper');
    if (reduced.matches) return;

    const origin = button.getBoundingClientRect();
    const stage = screen.getBoundingClientRect();
    const center = detail.getBoundingClientRect();
    const x = center.left + center.width / 2 - origin.left - origin.width / 2;
    const y = center.top + center.height / 2 - origin.top - origin.height / 2;
    flight = button.querySelector('.gallery-cover').cloneNode(true);
    flight.classList.add('gallery-flight');
    flight.setAttribute('aria-hidden', 'true');
    Object.assign(flight.style, {
      left: origin.left - stage.left + 'px', top: origin.top - stage.top + 'px',
      width: origin.width + 'px', height: origin.height + 'px'
    });
    overlay.append(flight);
    const image = flight;
    const zoom = Math.min(2, center.height / origin.height);
    image.animate([
      { transform: 'translate3d(0, 0, 0) scale(1)', opacity: 1 },
      { transform: `translate3d(${x}px,${y}px, 0) scale(${zoom}) rotateY(90deg)`, opacity: 0.96 }
    ], { duration: timings.fly, easing: 'cubic-bezier(.25,.7,.25,1)' }).onfinish = () => {
      image.remove();
      if (flight === image) flight = null;
    };
    turns = [detail.animate([
      { transform: 'perspective(900px) rotateY(-89deg) scale(.82)', opacity: 0 },
      { transform: 'perspective(900px) rotateY(0deg) scale(1)', opacity: 1 }
    ], { duration: timings.turn, delay: timings.fly, fill: 'backwards', easing: 'cubic-bezier(.18,.67,.25,1)' })];
  }

  function closeDetail(restoreFocus = true) {
    if (overlay.hidden) return;
    stopReading();
    stopMotion();
    overlay.hidden = true;
    selected = '';
    swipe = null;
    list.inert = toolbar.inert = false;
    if (restoreFocus) opener?.focus();
    opener = null;
  }

  function changeCard(direction) {
    if (unlocked.length < 2 || !selected) return;
    stopMotion();
    const index = unlocked.indexOf(selected);
    fillDetail(unlocked[(index + direction + unlocked.length) % unlocked.length]);
    sound('paper');
    if (!reduced.matches) {
      const parts = [$('gallery-detail-art'), detail.querySelector('.gallery-detail-copy')];
      turns = parts.map((part) => part.animate([
        { transform: `perspective(900px) rotateY(${direction * 45}deg)`, opacity: .4 },
        { transform: 'perspective(900px) rotateY(0deg)', opacity: 1 }
      ], { duration: timings.turn, easing: 'ease-out' }));
    }
  }

  function readCard() {
    if (!speech || !selected) return;
    if (speaking) {
      stopReading();
      return;
    }
    const utterance = new SpeechSynthesisUtterance(data.cards[selected].text);
    utterance.lang = cfg.lang;
    utterance.voice = speech.getVoices().find((voice) =>
      voice.lang.toLowerCase() === cfg.lang.toLowerCase() && voice.localService) ?? null;
    const reset = () => {
      if (speaking !== utterance) return;
      speaking = null;
      speak.textContent = cfg.speak;
    };
    utterance.onend = utterance.onerror = reset;
    speaking = utterance;
    speak.textContent = cfg.stop;
    try { speech.speak(utterance); } catch (error) { reset(); }
  }

  function close() {
    if (!active) return;
    active = false;
    closeDetail(false);
    screen.classList.remove('is-lighting');
    celebrateAt = Infinity;
    juice.clear();
    ctx?.clearRect(0, 0, fx.width, fx.height);
  }

  function frame(dt) {
    if (performance.now() >= celebrateAt) {
      celebrateAt = Infinity;
      if (collection.celebrate()) {
        sound('win');
        if (!reduced.matches) {
          for (const x of [W * .24, W * .5, W * .76]) {
            juice.confetti(x, H * .72, 28, ['#c8102e', '#f5b316', '#fff2c2', '#ec7850'], 310);
          }
        }
      }
    }
    if (!ctx || !juice.count()) return;
    juice.updateParticles(dt);
    ctx.clearRect(0, 0, fx.width, fx.height);
    ctx.save();
    ctx.scale(2, 2);
    juice.drawParticles(ctx);
    ctx.restore();
  }

  for (const [button, activate] of [
    [closeButton, () => closeDetail()],
    [prev, () => changeCard(-1)],
    [next, () => changeCard(1)],
    [speak, readCard]
  ]) {
    button.addEventListener('click', activate);
    button.addEventListener('touchend', (event) => {
      // A tap right after swiping can arrive without a synthetic click.
      const touch = event.changedTouches[0];
      if (button.disabled || !touch ||
          !button.contains(document.elementFromPoint(touch.clientX, touch.clientY))) return;
      event.preventDefault();
      activate();
    }, { passive: false });
  }
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) closeDetail();
  });
  detail.addEventListener('pointerdown', (event) => {
    if (event.pointerType !== 'touch' || event.target.closest('button')) return;
    swipe = { x: event.clientX, y: event.clientY, id: event.pointerId };
    detail.setPointerCapture(event.pointerId);
  });
  detail.addEventListener('pointerup', (event) => {
    if (swipe?.id !== event.pointerId) return;
    const x = event.clientX - swipe.x;
    const y = event.clientY - swipe.y;
    swipe = null;
    if (Math.abs(x) >= cfg.swipe && Math.abs(x) > Math.abs(y) * 1.35) changeCard(x < 0 ? 1 : -1);
  });
  detail.addEventListener('pointercancel', () => { swipe = null; });
  window.addEventListener('keydown', (event) => {
    if (!active) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      if (selected) closeDetail();
      else core.showScreen('menu');
    } else if (selected && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
      event.preventDefault();
      if (!event.repeat) changeCard(event.key === 'ArrowLeft' ? -1 : 1);
    } else if (selected && event.key === 'Tab') {
      const buttons = [...detail.querySelectorAll('button:not([disabled]):not([hidden])')];
      const boundary = event.shiftKey ? buttons[0] : buttons.at(-1);
      if (document.activeElement === boundary) {
        event.preventDefault();
        (event.shiftKey ? buttons.at(-1) : buttons[0]).focus();
      }
    }
  });
  window.TULOU_GALLERY = { open, close, frame, get active() { return active; } };
})();
