// PlateTrack | Service Worker
//
// Minimal service worker so the app can be "installed" on a phone's home
// screen (Chrome/Android requires a registered service worker with a
// fetch handler for the install prompt to appear). It caches the shared
// static assets (CSS/JS) so the app's shell loads instantly on repeat
// visits, while always going to the network first for API calls (which
// must never be served from a stale cache).

const CACHE_NAME = "platetrack-shell-v1";

const SHELL_ASSETS = [
    "../shared/css/dashboard.css",
    "../shared/css/modal.css",
    "../shared/css/history.css",
    "../shared/js/config.js",
    "../shared/js/modal.js",
    "../shared/js/theme.js",
    "img/icon-192.png",
    "img/icon-512.png",
];

self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            // Best-effort: don't fail install if one asset 404s (some
            // pages don't use every shared file).
            return Promise.allSettled(
                SHELL_ASSETS.map((url) => cache.add(url))
            );
        })
    );
    self.skipWaiting();
});

self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches.keys().then((names) =>
            Promise.all(
                names
                    .filter((name) => name !== CACHE_NAME)
                    .map((name) => caches.delete(name))
            )
        )
    );
    self.clients.claim();
});

self.addEventListener("fetch", (event) => {

    const url = new URL(event.request.url);

    // Never cache API calls -- always go straight to the network so data
    // is always fresh (violations, notifications, detection results, etc.)
    if (url.pathname.startsWith("/api/") || event.request.method !== "GET") {
        return;
    }

    event.respondWith(
        caches.match(event.request).then((cached) => {
            if (cached) {
                return cached;
            }

            return fetch(event.request).then((response) => {
                // Only cache successful, same-origin responses.
                if (response.ok && url.origin === self.location.origin) {
                    const responseClone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseClone);
                    });
                }
                return response;
            }).catch(() => cached);
        })
    );

});
