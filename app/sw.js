/* Schrijfpad service worker: de app-schil werkt offline.
 * Sessies (WebSocket) hebben uiteraard wel het netwerk nodig.
 */
const VERSION = 'schrijfpad-v6';
const SHELL = [
  './',
  './index.html',
  './css/style.css',
  './js/main.js',
  './js/letters.js',
  './js/strokes.js',
  './js/engine.js',
  './js/net.js',
  './js/vendor-qrcode.js',
  './fonts/andika-400.woff2',
  './fonts/andika-700.woff2',
  './fonts/atkinson-hyperlegible-400.woff2',
  './fonts/atkinson-hyperlegible-700.woff2',
  './manifest.webmanifest',
  './icons/icon.svg',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Netwerk eerst (zo komen updates meteen door), cache als vangnet offline.
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(VERSION).then((c) => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: url.pathname === '/' }).then((m) => m || caches.match('/')))
  );
});
