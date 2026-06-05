self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open('sandexpress-v2').then((cache) => {
      return cache.addAll(['/', '/manifest.json', '/icon-192.png', '/icon-512.png', '/sandexpress-logo.svg']);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) => key !== 'sandexpress-v2').map((key) => caches.delete(key))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.pathname.startsWith('/api/')) {
    return;
  }

  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request);
    })
  );
});
