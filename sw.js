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
/* Cache first: a launch never waits for the network, and works offline or on a bad connection.
   The cache is versioned by content, so a new worker installs a complete, matching set. */
const PAGE = new URL('index.html', self.registration.scope).href;
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url),
    navigation = request.mode === 'navigate';
  if (url.origin !== self.location.origin || !(navigation || assetURLs.has(url.href))) return;
  event.respondWith(
    (async () => {
      const cached = await caches.match(navigation ? PAGE : request, {
        cacheName: CACHE,
        ignoreSearch: true,
      });
      if (cached) return cached;
      try {
        return await fetch(request);
      } catch {
        return new Response('This asset is unavailable offline.', { status: 503 });
      }
    })(),
  );
});
