/**
 * Service Worker for PWA offline support.
 * Strategy: cache-first for the static app shell, network-only for the API.
 *
 * Registered from src/serviceWorkerRegistration.ts.
 */

const VERSION = "v4";
const STATIC_CACHE = `stonepark-cb-static-${VERSION}`;

const STATIC_ASSETS = [
  "/",
  "/index.html",
  "/manifest.json",
  "/favicon.ico",
  "/logo192.png",
  "/logo512.png",
];

const MAX_STATIC_CACHE_SIZE = 100;

/**
 * Trim a cache to a maximum number of entries, evicting oldest first.
 */
async function trimCache(cacheName, maxSize) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length > maxSize) {
    const toDelete = keys.slice(0, keys.length - maxSize);
    await Promise.all(toDelete.map((key) => cache.delete(key)));
  }
}

// Install – pre-cache the app shell
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(STATIC_ASSETS)),
  );
  self.skipWaiting();
});

// Activate – drop every cache from a previous version
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== STATIC_CACHE).map((k) => caches.delete(k)),
        ),
      ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const cloned = response.clone();
            caches.open(STATIC_CACHE).then((cache) => {
              cache.put(request, cloned);
              trimCache(STATIC_CACHE, MAX_STATIC_CACHE_SIZE);
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

  // API responses are never cached.
  //
  // Every endpoint is now behind a whitelisted account, and the payloads name
  // the staff who borrowed each device. Writing that to CacheStorage would
  // leave one teacher's data readable on a shared iPad after they signed out.
  //
  // Serving a cached copy offline was also actively misleading here: a stale
  // "available" cabinet is worse than an honest error, because the teacher
  // walks to a cabinet that someone else already took.
  if (url.pathname.startsWith("/api/")) {
    return; // fall through to the network, no SW involvement
  }

  // Cache-first for the static shell (hashed bundles, icons, manifest).
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.ok) {
          const cloned = response.clone();
          caches.open(STATIC_CACHE).then((cache) => {
            cache.put(request, cloned);
            trimCache(STATIC_CACHE, MAX_STATIC_CACHE_SIZE);
          });
        }
        return response;
      });
    }),
  );
});

// Sign-out asks us to drop anything user-specific we may still hold from an
// older version of this worker.
self.addEventListener("message", (event) => {
  if (event.data?.type === "CLEAR_CACHES") {
    event.waitUntil(
      caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k)))),
    );
  }
});
