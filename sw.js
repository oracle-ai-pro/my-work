/* My Work service worker */
const CACHE = 'mywork-hub-v1';
const ASSETS = ['./', './index.html', './manifest.json', './My%20Work.png', './My Work.png'];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS).catch(()=>{})).then(()=>self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  e.respondWith(
    caches.match(req).then(cached => {
      const net = fetch(req).then(res => {
        if (res && res.ok && /\.(html|css|js|png|svg|json)$/i.test(url.pathname)) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(req, clone)).catch(()=>{});
        }
        return res;
      }).catch(() => cached);
      return cached || net;
    })
  );
});
