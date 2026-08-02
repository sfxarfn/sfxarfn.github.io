// The offline asset cache.
//
// Why it exists: GitHub Pages sends `Cache-Control: max-age=600` on everything it serves and does
// not let you change it. Ten minutes after a visit the browser is free to throw away 17 MB of
// character models, so a player who comes back after lunch downloads all of them again. Switching
// characters inside one session was never the expensive part — the HTTP cache already covers that.
//
// Why cache-first is safe here: Vite content-hashes everything it writes into `assets/`
// (`poli-TJ9g5L0p.glb`), so a cached asset URL can never go stale — a changed file is a different
// URL. That holds for `assets/` and nothing else, which is exactly where the line is drawn below.
// The HTML that names those hashes is *not* hashed, so it is fetched network-first: a stale copy
// of it would pin the whole game to a set of hashes that no longer exist.
//
// This file is served verbatim out of `public/`, so it gets no `%BASE_URL%` substitution and no
// bundling. It must stay dependency-free and valid on its own.

// Two caches rather than one, because only half of this is safe to evict. The hashed assets are
// bounded and trimmed; the shell is a handful of small files that a trim could throw out from
// under an offline visit.
const ASSETS = 'robocar-assets-v1';
const SHELL = 'robocar-shell-v1';
const KEEP = new Set([ASSETS, SHELL]);

// Two builds' worth of models and bundles. A hashed name is never overwritten, only added beside
// the old one, so without a cap every deploy would leave another 17 MB behind forever.
const MAX_ENTRIES = 24;

// Everything under `assets/` is hashed by the build. Public files (the manifest, the icons, the
// character portraits) keep their names across builds and are deliberately not in here.
const isHashedAsset = (url) => url.pathname.includes('/assets/');

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) {
      if (!KEEP.has(name)) await caches.delete(name);
    }
    // Without this the worker only starts serving the tab that comes after this one, and the visit
    // that installed it gets no cache at all.
    await self.clients.claim();
  })());
});

// `cache.keys()` is in insertion order, so the front of it is the oldest thing cached.
async function trim(cache) {
  const keys = await cache.keys();
  for (const key of keys.slice(0, keys.length - MAX_ENTRIES)) await cache.delete(key);
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  // Only plain GETs off this origin: a range request (which is how some browsers pull media) and
  // anything cross-origin are both left entirely alone.
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (isHashedAsset(url)) {
    event.respondWith((async () => {
      const cache = await caches.open(ASSETS);
      const hit = await cache.match(request);
      if (hit) return hit;

      const response = await fetch(request);
      // Opaque and error responses are not worth keeping — caching a 404 would serve it back for
      // as long as the entry survives.
      if (response.ok && response.type === 'basic') {
        await cache.put(request, response.clone());
        await trim(cache);
      }
      return response;
    })());
    return;
  }

  // Everything else — the HTML, the manifest, the icons, the character portraits. Network wins so
  // a new deploy is picked up immediately; the cache is only the answer when the network has none.
  event.respondWith((async () => {
    try {
      const response = await fetch(request);
      if (response.ok && response.type === 'basic') {
        const cache = await caches.open(SHELL);
        await cache.put(request, response.clone());
      }
      return response;
    } catch (error) {
      const hit = await caches.match(request);
      if (hit) return hit;
      throw error;
    }
  })());
});
