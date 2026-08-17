/*
 * Web Push handlers, pulled into the Workbox-generated service worker via
 * `workbox.importScripts` in vite.config.ts. Kept as a plain file in public/ so
 * the PWA plugin can stay on its default generateSW strategy.
 *
 * Served with no-store (see vercel.json) — an imported script that gets cached
 * hard would pin the app to an old handler.
 */

/** Falls back to a generic nudge if the payload is missing or not JSON. */
function readPayload(event) {
  const fallback = {
    title: 'FabXpert Time',
    body: 'Ai o notificare nouă.',
    tag: 'fabxpert-notification',
  };

  if (!event.data) {
    return fallback;
  }

  try {
    const data = event.data.json();
    return {
      title: typeof data.title === 'string' ? data.title : fallback.title,
      body: typeof data.body === 'string' ? data.body : fallback.body,
      tag: typeof data.tag === 'string' ? data.tag : fallback.tag,
    };
  } catch {
    return { ...fallback, body: event.data.text() || fallback.body };
  }
}

self.addEventListener('push', (event) => {
  const payload = readPayload(event);

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      tag: payload.tag,
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      /** Stays in the tray until tapped — ignored on iOS, honoured on Android. */
      requireInteraction: true,
      data: { url: '/' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = new URL(event.notification.data?.url || '/', self.location.origin).href;

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clients) => {
        for (const client of clients) {
          if (client.url.startsWith(self.location.origin) && 'focus' in client) {
            return client.focus();
          }
        }
        return self.clients.openWindow(targetUrl);
      }),
  );
});
