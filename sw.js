
const CACHE_NAME = 'yoshi-cash-v2';
const ASSETS = [
  './',
  './index.html',
  './metadata.json',
  'https://cdn.tailwindcss.com',
  'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.map((k) => k !== CACHE_NAME && caches.delete(k))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((res) => {
      const fetchPromise = fetch(e.request).then((networkRes) => {
        if (networkRes && networkRes.status === 200) {
          const cacheCopy = networkRes.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(e.request, cacheCopy));
        }
        return networkRes;
      }).catch(() => null);
      return res || fetchPromise;
    })
  );
});
