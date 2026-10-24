// push-sw.js — loaded into Polly's service worker (see vite.config.ts).
// Shows a notification when the server sends a push, and opens Polly
// when the notification is tapped.

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : '' };
  }
  const title = data.title || 'Polly';
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || '',
      icon: '/pollyicondots.png',
      badge: '/pollyicondots.png',
      tag: data.tag || 'polly-daily',
      data: { url: data.url || '/' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ('focus' in client) return client.focus();
      }
      return self.clients.openWindow(url);
    }),
  );
});