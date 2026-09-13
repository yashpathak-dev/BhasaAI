const CACHE_NAME = 'bhasa-ai-offline-v1';
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/demo.html',
    '/static/javascript/script.js',
    '/static/data/ncert_db.json'
];

// Install: Cache core application assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[ServiceWorker] Caching app shell and NCERT DB');
            return cache.addAll(STATIC_ASSETS);
        })
    );
    self.skipWaiting();
});

// Activate: Clean old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.map((key) => {
                    if (key !== CACHE_NAME) {
                        return caches.delete(key);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

// Fetch: Serve from Cache first, fallback to Network
self.addEventListener('fetch', (event) => {
    // Only handle GET requests for static assets and JSON files
    if (event.request.method === 'GET') {
        event.respondWith(
            caches.match(event.request).then((cachedResponse) => {
                if (cachedResponse) {
                    return cachedResponse;
                }
                return fetch(event.request).then((networkResponse) => {
                    // Cache dynamically fetched static assets
                    if (event.request.url.includes('/static/')) {
                        return caches.open(CACHE_NAME).then((cache) => {
                            cache.put(event.request, networkResponse.clone());
                            return networkResponse;
                        });
                    }
                    return networkResponse;
                });
            }).catch(() => {
                // Fallback if offline and asset not in cache
                if (event.request.headers.get('accept').includes('text/html')) {
                    return caches.match('/index.html');
                }
            })
        );
    }
});

