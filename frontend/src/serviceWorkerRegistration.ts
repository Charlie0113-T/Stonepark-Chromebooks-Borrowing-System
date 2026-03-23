/**
 * Service Worker registration for PWA offline support.
 * Call register() in src/index.tsx to enable offline caching.
 */

export function register() {
  if (process.env.NODE_ENV !== 'production') return;
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      const swUrl = `${process.env.PUBLIC_URL}/sw.js`;
      navigator.serviceWorker
        .register(swUrl)
        .then((registration) => {
          console.log('[SW] Registered:', registration.scope);
          registration.update();
          registration.onupdatefound = () => {
            const installingWorker = registration.installing;
            if (!installingWorker) return;
            installingWorker.onstatechange = () => {
              if (installingWorker.state === 'installed') {
                if (navigator.serviceWorker.controller) {
                  console.log('[SW] New content available; reloading once.');
                  if (!sessionStorage.getItem('sw_reloaded')) {
                    sessionStorage.setItem('sw_reloaded', '1');
                    window.location.reload();
                  }
                } else {
                  console.log('[SW] Content cached for offline use.');
                }
              }
            };
          };
        })
        .catch((error) => {
          console.error('[SW] Registration failed:', error);
        });
    });
  }
}

export function unregister() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready
      .then((registration) => registration.unregister())
      .catch((error) => console.error(error.message));
  }
}
