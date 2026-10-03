/* This worker only owns Pal Pop's own cache and scope. Older palpop-* caches are removed on activation. */
importScripts('./precache.js');
const PREFIX = 'palpop-';
const CACHE = PREFIX + CACHE_VERSION;
const assetURLs = new Set(PRECACHE.map((asset) => new URL(asset, self.registration.scope).href));
self.addEventListener('install', (event) =>
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await cache.addAll(PRECACHE);
      await self.skipWaiting();
    })(),
  ),
);
self.addEventListener('activate', (event) =>
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith(PREFIX) && key !== CACHE)
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  ),
);
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || !assetURLs.has(url.href)) return;
  event.respondWith(
    (async () => {
      try {
        return await fetch(event.request);
      } catch {
        const cached = await caches.match(event.request, { cacheName: CACHE });
        if (cached) return cached;
        return new Response('This asset is unavailable offline.', { status: 503 });
      }
    })(),
  );
});
