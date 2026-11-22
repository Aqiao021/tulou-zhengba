'use strict';

// The export script replaces this value with a fingerprint of the runtime files.
const VERSION = '1';
const scope = new URL(self.registration.scope);
const cachePrefix = 'tulou:' + scope.href + ':';
const cacheName = cachePrefix + VERSION;
const urlFor = (relative) => new URL(relative, scope).href;
const inventoryUrl = urlFor('pwa-files.json');
const indexUrl = urlFor('index.html');

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const response = await fetch(inventoryUrl, { cache: 'reload' });
    if (!response.ok) throw new Error('Cannot load PWA inventory');
    const entries = await response.clone().json();
    const cache = await caches.open(cacheName);
    await cache.addAll(entries.map((name) => new Request(urlFor(name), { cache: 'reload' })));
    await cache.put(inventoryUrl, response);
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter((key) => key.startsWith(cachePrefix) && key !== cacheName)
      .map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== scope.origin || !url.pathname.startsWith(scope.pathname)) return;
  const path = url.pathname.slice(scope.pathname.length);
  const entry = path === '' || path === 'index.html';
  // LAN probing, WebSocket connections and URLs outside the exported game use the network.
  if (!entry && path !== 'manifest.webmanifest' && path !== 'pwa-files.json' && !/^(assets|css|js)\//.test(path)) return;
  event.respondWith((async () => {
    const cache = await caches.open(cacheName);
    const hit = await cache.match(entry ? indexUrl : request);
    return hit || fetch(request);
  })());
});
