/* CLT LM Scoreboard — service worker (Jordan's app).
   HTML shell: NETWORK-FIRST (always pick up a new release on launch when online).
   Versioned assets (?v=N): cache-first. Live data (Apps Script /exec): never cached. */
const CACHE = 'clt-lm-v10';
const V = '31';
const SHELL = ['./lm.html', './lm-view.js?v=' + V, './lm-view.css?v=' + V, './lm-engine.js?v=' + V, './lm-gamify.js?v=' + V, './manifest-lm.json', './icon-192.png', './icon-512.png', './apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin || url.hostname.indexOf('script.google') > -1) return;
  // HTML shell → network-first so a new release lands on next launch; fall back to cache offline.
  if (e.request.mode === 'navigate' || url.pathname.endsWith('.html')) {
    e.respondWith(
      fetch(e.request).then(r => { const c = r.clone(); caches.open(CACHE).then(cache => cache.put(e.request, c)); return r; })
        .catch(() => caches.match(e.request).then(h => h || caches.match('./lm.html')))
    );
    return;
  }
  // versioned assets → cache-first
  e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request)));
});
