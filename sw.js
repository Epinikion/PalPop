const CACHE = 'palpop-v12-festival';
const ASSETS = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k.startsWith('palpop-v') && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

/* stale-while-revalidate: serve instantly from cache, always refresh in the background */
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || !e.request.url.startsWith(self.location.origin)) return;
  e.respondWith(
    caches.open(CACHE).then(c =>
      c.match(e.request).then(hit => {
        const refresh = fetch(e.request).then(res => {
          if (res.ok) { const copy = res.clone(); c.put(e.request, copy); }
          return res;
        }).catch(() => hit);
        return hit || refresh;
      })
    )
  );
});
