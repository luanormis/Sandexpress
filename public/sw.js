self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open('sandexpress-v1').then((cache) => {
      return cache.addAll(['/', '/manifest.json', '/icon-192.png']);
    })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});
