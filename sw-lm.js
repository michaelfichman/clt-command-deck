/* CLT LM Scoreboard — service worker (Jordan's app).
   Shell: cache-first. Live data (Apps Script /exec): network-only, never cached. */
const CACHE = 'clt-lm-v8';
const SHELL = ['./lm.html', './lm-view.js', './lm-view.css', './lm-engine.js', './lm-gamify.js', './manifest-lm.json', './icon-192.png', './icon-512.png', './apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  // never cache the live endpoint or cross-origin GETs (Apps Script, fonts CDN handled by browser)
  if (e.request.method !== 'GET' || url.hostname.indexOf('script.google') > -1) return;
  if (url.origin !== location.origin) return;
  e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request)));
});
