
const CACHE_NAME = 'yoshicash-v14';
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json'
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

  // Estrategia: Network First, falling back to cache
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Si la red responde bien, cacheamos y devolvemos
        if (response && response.status === 200) {
          const cacheCopy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, cacheCopy));
          return response;
        }
        
        // Si el servidor devuelve 404 en una navegación, devolvemos el index de la caché
        if (response.status === 404 && event.request.mode === 'navigate') {
          return caches.match('/') || caches.match('/index.html');
        }
        
        return response;
      })
      .catch(() => {
        // Offline o fallo de red
        return caches.match(event.request).then((cached) => {
          if (cached) return cached;
          
          if (event.request.mode === 'navigate') {
            return caches.match('/') || caches.match('/index.html');
          }
        });
      })
  );
});
