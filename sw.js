
const CACHE_NAME = 'yoshicash-v12';
const ASSETS = [
  './',
  'index.html',
  'manifest.json'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.allSettled(
        ASSETS.map(asset => cache.add(asset))
      );
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
    ))
  );
  return self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const networked = fetch(event.request)
        .then((response) => {
          // Si la respuesta es válida, la guardamos en cache
          if (response && response.status === 200) {
            const cacheCopy = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, cacheCopy));
          }
          return response;
        })
        .catch(() => {
          // Si falla la red y es una navegación, devolvemos index.html para evitar el 404
          if (event.request.mode === 'navigate') {
            return caches.match('index.html');
          }
          return cached;
        });

      return cached || networked;
    })
  );
});
