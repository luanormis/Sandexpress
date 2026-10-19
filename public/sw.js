self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open('sandexpress-v9').then((cache) => {
      return cache.addAll(['/', '/vendor/login', '/garcom/login', '/manifest.json', '/sandexpress-app-icon-192.png', '/sandexpress-app-icon-512.png', '/sandexpress-app-icon-180.png', '/logo-sandexpress.png', '/sounds/cash-register-kaching.mp3', '/sounds/order-bell.mp3']);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) => key !== 'sandexpress-v9').map((key) => caches.delete(key))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.pathname.startsWith('/api/')) {
    return;
  }

  event.respondWith((async () => {
    try {
      const response = await fetch(event.request);
      if (response.ok && url.origin === self.location.origin) {
        const cache = await caches.open('sandexpress-v9');
        await cache.put(event.request, response.clone());
      }
      return response;
    } catch {
      const cached = await caches.match(event.request);
      if (cached) return cached;
      if (event.request.mode === 'navigate') return (await caches.match('/'));
      throw new Error('offline');
    }
  })());
});
