/*
 * The service worker: a small script the browser keeps on the phone for this site.
 * Its one job is to save a copy of the app so the meter opens with no signal,
 * which is exactly when you need it (a market, a warehouse, a basement shop).
 *
 * VERSION and FILES are filled in by scripts/stamp-sw.mjs at build time.
 * A new build gets a new VERSION, and that is what tells phones to throw away
 * the old copy and save the new one.
 */

const VERSION = '__VERSION__';
const CACHE = `mol-bhav-meter-${VERSION}`;
const FILES = ['__FILES__'];

// First visit: save every file the app needs.
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(FILES))
      .then(() => self.skipWaiting()),
  );
});

// New version installed: delete the copies saved by older versions.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names
            .filter((name) => name.startsWith('mol-bhav-meter-') && name !== CACHE)
            .map((name) => caches.delete(name)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const sameSite = new URL(request.url).origin === self.location.origin;
  if (request.method !== 'GET' || !sameSite) return;

  if (request.mode === 'navigate') {
    // The page itself: ask the network first so you always get the newest version.
    // No signal? Hand back the saved copy.
    event.respondWith(fetch(request).catch(() => caches.match('./')));
    return;
  }

  // Code, fonts and icons: the saved copy is instant, so use it. Network only if it's missing.
  event.respondWith(caches.match(request, { ignoreSearch: true }).then((saved) => saved ?? fetch(request)));
});
