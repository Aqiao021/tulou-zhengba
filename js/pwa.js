(function () {
  'use strict';

  const { protocol, hostname } = location;
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(hostname);
  if (!(protocol === 'https:' || (protocol === 'http:' && loopback)) ||
      window.Capacitor?.isNativePlatform?.() || !('serviceWorker' in navigator)) return;

  navigator.serviceWorker.register('./service-worker.js', { updateViaCache: 'none' }).catch((error) => {
    console.warn('离线缓存暂不可用', error);
  });
})();
