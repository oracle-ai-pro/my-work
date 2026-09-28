const CACHE = 'mykeeps-v1';
const ASSETS = ['./', './index.html', './style.css', './script.js', './manifest.webmanifest', './keeps.png'];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(async (c) => {
    for (const u of ASSETS) { try { await c.add(u); } catch (err) {} }
  }).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  e.respondWith(caches.match(req).then((cached) => {
    const net = fetch(req).then((res) => {
      if (res && res.ok) {
        const p = url.pathname;
        if (/\.(html|css|js|webmanifest|png)$/i.test(p) || p.endsWith('/')) {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(req, clone)).catch(() => {});
        }
      }
      return res;
    }).catch(() => cached || caches.match('./index.html'));
    return cached || net;
  }));
});
