// Service Worker — placeholder for FabXpert Mobile PWA.
// Full offline/caching strategy will be implemented in a future step.

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Pass all requests through to the network for now.
  event.respondWith(fetch(event.request));
});
