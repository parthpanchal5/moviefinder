// Movie Finder service worker — offline app shell + runtime caching.
const VERSION = "v6";
const SHELL_CACHE = `mf-shell-${VERSION}`;
const RUNTIME_CACHE = `mf-runtime-${VERSION}`;

// App shell — keep query strings in sync with index.html asset versions.
const SHELL = [
  "./",
  "./index.html",
  "./style.css?v=6",
  "./main.js?v=6",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
  "./icons/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== SHELL_CACHE && k !== RUNTIME_CACHE)
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Navigations: network-first, fall back to cached shell (offline).
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => caches.match("./index.html"))
    );
    return;
  }

  // OMDb API: stale-while-revalidate so data/posters work offline after first load.
  if (url.hostname === "www.omdbapi.com") {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  // Poster images (Amazon CDN): cache-first runtime.
  if (url.hostname.endsWith("media-amazon.com")) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Same-origin static assets: cache-first.
  if (url.origin === self.location.origin) {
    event.respondWith(cacheFirst(request));
    return;
  }
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const res = await fetch(request);
    if (res.ok || res.type === "opaque") {
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(request, res.clone());
    }
    return res;
  } catch (_) {
    return cached || Response.error();
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((res) => {
      if (res.ok) cache.put(request, res.clone());
      return res;
    })
    .catch(() => cached);
  return cached || network;
}
