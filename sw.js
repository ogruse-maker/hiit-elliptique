// HIIT Elliptique — Service Worker v1.1
const CACHE_NAME = 'hiit-elliptique-v2';
const ASSETS = [
  './hiit-elliptique.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700&family=JetBrains+Mono:wght@400;700&display=swap',
];

// Installation : mise en cache de tous les assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        // Cache les assets locaux d'abord, les fonts en best-effort
        return cache.addAll(['./hiit-elliptique.html', './manifest.json'])
          .then(() => cache.addAll(['./icon-192.png', './icon-512.png']).catch(() => {}))
          .then(() => cache.addAll([
            'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700&family=JetBrains+Mono:wght@400;700&display=swap'
          ]).catch(() => {}));
      })
  );
  self.skipWaiting();
});

// Activation : nettoyage des anciens caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// Fetch : Cache First pour les assets locaux, Network First pour les fonts
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Bluetooth et APIs natives — jamais interceptées
  if (event.request.url.includes('bluetooth') ||
      event.request.url.includes('chrome-extension')) {
    return;
  }

  // Fonts Google — Network First avec fallback cache
  if (url.hostname.includes('fonts.googleapis.com') ||
      url.hostname.includes('fonts.gstatic.com')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Le document HTML principal — Network First : on essaie toujours le réseau
  // en premier pour avoir la dernière version, et on ne retombe sur le cache
  // qu'en cas d'échec (mode hors-ligne). Évite de resservir indéfiniment une
  // vieille version mise en cache une fois pour toutes.
  if (event.request.mode === 'navigate' || url.pathname.endsWith('hiit-elliptique.html')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Autres assets locaux (icônes, manifest) — Cache First
  event.respondWith(
    caches.match(event.request)
      .then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(response => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return response;
        });
      })
  );
});

// Message pour forcer la mise à jour
self.addEventListener('message', event => {
  if (event.data === 'skipWaiting') self.skipWaiting();
});
