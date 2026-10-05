/* This worker only owns Pal Pop's own cache and scope. Older palpop-* caches are removed on activation. */
/* BUILD changes with every version of the app (npm run cache:update writes it). It makes this file
   differ byte for byte, so a browser always notices an update, and it is part of the precache URL, so
   a stale copy of the list can never be served from an HTTP cache. */
const BUILD = '9a4c893e02099925';
importScripts('./precache.js?v=' + BUILD);
const PREFIX = 'palpop-';
const CACHE = PREFIX + CACHE_VERSION;
const assetURLs = new Set(PRECACHE.map((asset) => new URL(asset, self.registration.scope).href));
self.addEventListener('install', (event) =>
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      // Straight from the network, never from an HTTP cache: a complete, matching set.
      await cache.addAll(
        PRECACHE.map(
          (asset) => new Request(new URL(asset, self.registration.scope), { cache: 'reload' }),
        ),
      );
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
