/**
 * Service Worker for PWA offline support.
 * Strategy: Cache-first for static assets, network-first for API calls.
 *
 * This file is registered via src/serviceWorkerRegistration.ts.
 */

const CACHE_NAME = "stonepark-cb-v3"; // Bumped from v2 to v3 for cache-affecting changes
const STATIC_ASSETS = [
  "/",
  "/index.html",
  "/manifest.json",
  "/favicon.ico",
  "/logo192.png",
  "/logo512.png",
];

const MAX_API_CACHE_SIZE = 50;
const MAX_STATIC_CACHE_SIZE = 100;

// Sensitive paths that must never be cached
const EXCLUDED_API_PATHS = ["/api/auth/"];

function isExcludedPath(pathname) {
  return EXCLUDED_API_PATHS.some((prefix) => pathname.startsWith(prefix));
}

/**
 * Trim a cache to a maximum number of entries by evicting the oldest ones first.
 */
async function trimCache(cacheName, maxSize) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length > maxSize) {
    const toDelete = keys.slice(0, keys.length - maxSize);
    await Promise.all(toDelete.map((key) => cache.delete(key)));
  }
}

// Install – pre-cache static shell
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)),
  );
  self.skipWaiting();
});

// Activate – clean up old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)),
        ),
      ),
  );
  self.clients.claim();
});

// Fetch – cache-first for static, network-first for API
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const cloned = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, cloned);
              trimCache(CACHE_NAME, MAX_STATIC_CACHE_SIZE);
            });
          }
          return response;
        })
        .catch(() =>
          caches
            .match(request)
            .then((cached) => cached || caches.match("/index.html")),
        ),
    );
    return;
  }

  // Network-first for API calls
  if (url.pathname.startsWith("/api/")) {
    // Never cache sensitive auth paths
    if (isExcludedPath(url.pathname)) {
      event.respondWith(fetch(request));
      return;
    }

    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache successful GET responses
          if (request.method === "GET" && response.ok) {
            const cloned = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, cloned);
              trimCache(CACHE_NAME, MAX_API_CACHE_SIZE);
            });
          }
          return response;
        })
        .catch(() => caches.match(request)),
    );
    return;
  }

  // Cache-first for everything else (static assets / app shell)
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.ok) {
          const cloned = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, cloned);
            trimCache(CACHE_NAME, MAX_STATIC_CACHE_SIZE);
          });
        }
        return response;
      });
    }),
  );
});
