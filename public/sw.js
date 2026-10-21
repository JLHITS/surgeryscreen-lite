/*
 * SurgeryScreen display service worker.
 *
 * Keeps a waiting-room screen playing through wifi drops: immutable assets and
 * slide images are cached, the published snapshot is served network-first with
 * an offline fallback, and the display page itself falls back to cache if the
 * device reloads while offline.
 */
const CACHE = "surgeryscreen-v1";

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res && res.ok) cache.put(request, res.clone());
  return res;
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const res = await fetch(request);
    if (res && res.ok) cache.put(request, res.clone());
    return res;
  } catch (err) {
    const hit = await cache.match(request);
    if (hit) return hit;
    throw err;
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Immutable assets (hashed bundles, normalised slide images, static logos).
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/api/media/") ||
    url.pathname === "/nhs-logo.svg" ||
    url.pathname === "/nhs-logo-white.svg" ||
    url.pathname === "/logo.png"
  ) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Published snapshot: fresh online, last-known offline.
  if (url.pathname.startsWith("/api/display/")) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Page navigations (the display itself): survive an offline reload.
  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request));
    return;
  }
});
