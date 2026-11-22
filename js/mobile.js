(function () {
  'use strict';

  if (!matchMedia('(pointer: coarse)').matches) return;

  document.addEventListener('click', () => {
    if (document.fullscreenElement || matchMedia('(display-mode: fullscreen)').matches) return;
    const page = document.documentElement;
    if (!page.requestFullscreen) return;
    try {
      page.requestFullscreen({ navigationUI: 'hide' })?.catch(() => {});
    } catch {
      // Some browsers and embedded WebViews disallow fullscreen.
    }
  }, { capture: true, once: true });
})();
