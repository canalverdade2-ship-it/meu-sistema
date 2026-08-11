const CACHE_NAME = 'gsa-store-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  '/logo-gsa-hub.jpg'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response; // Cache hit
        }
        return fetch(event.request);
      }
    )
  );
});
