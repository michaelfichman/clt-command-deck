/* CLT Command Deck — service worker.
   HTML shell: NETWORK-FIRST (always pick up a new release on launch when online).
   Versioned assets (?v=N): cache-first. Live data (Apps Script endpoint): never cached. */
const CACHE = 'clt-deck-v34';
const V = '34';
const SHELL = ['./index.html', './lm-view.js?v=' + V, './lm-view.css?v=' + V, './lm-engine.js?v=' + V, './lm-gamify.js?v=' + V, './manifest.json', './icon-192.png', './icon-512.png', './apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (url.hostname.includes('script.google') || url.hostname.includes('googleusercontent')) return; // live data: network only
  // HTML shell → network-first so a new release lands on next launch; fall back to cache offline.
  if (e.request.method === 'GET' && (e.request.mode === 'navigate' || url.pathname.endsWith('.html'))) {
    e.respondWith(
      fetch(e.request).then(res => { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return res; })
        .catch(() => caches.match(e.request).then(h => h || caches.match('./index.html')))
    );
    return;
  }
  // assets (versioned same-origin + fonts/cdn) → cache-first, populate on first fetch
  e.respondWith(
    caches.match(e.request).then(hit => hit || fetch(e.request).then(res => {
      if (e.request.method === 'GET' && res.ok && (url.origin === location.origin || url.hostname.includes('cdnjs') || url.hostname.includes('gstatic') || url.hostname.includes('googleapis'))) {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
      }
      return res;
    }).catch(() => caches.match('./index.html')))
  );
});
