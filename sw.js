
const CACHE_NAME = 'yoshicash-v13';
const ASSETS = [
  './',
  'index.html',
  'manifest.json'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Intentamos cachear todos los assets críticos
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
          // Si la respuesta es exitosa (200 OK), actualizamos la caché
          if (response && response.status === 200) {
            const cacheCopy = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, cacheCopy));
          }
          // Si es un error 404 en una navegación, devolvemos la caché si existe
          if (response.status === 404 && event.request.mode === 'navigate') {
            return cached || caches.match('./') || caches.match('index.html');
          }
          return response;
        })
        .catch(() => {
          // En caso de fallo total de red (offline), servimos el fallback de navegación
          if (event.request.mode === 'navigate') {
            return cached || caches.match('./') || caches.match('index.html');
          }
          return cached;
        });

      return cached || networked;
    })
  );
});
