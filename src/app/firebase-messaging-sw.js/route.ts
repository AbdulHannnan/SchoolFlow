/**
 * Serves the Firebase Cloud Messaging service worker at `/firebase-messaging-sw.js`
 * (root scope, required for Web Push — Module 4.4). It's a route handler rather
 * than a static /public file so the public Firebase config is injected from the
 * environment at request time. With no config set, the worker is inert (and the
 * client never registers it anyway), keeping local dev push-free but functional.
 */

// Compat SDK is used inside the worker (modular SDK has no service-worker build).
const FIREBASE_SDK_VERSION = "10.12.0";

export async function GET(): Promise<Response> {
  const config = process.env.NEXT_PUBLIC_FIREBASE_CONFIG ?? "null";

  const body = `importScripts('https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}/firebase-messaging-compat.js');

const firebaseConfig = ${config};

if (firebaseConfig) {
  firebase.initializeApp(firebaseConfig);
  const messaging = firebase.messaging();

  // Render notifications that arrive while the app is in the background.
  messaging.onBackgroundMessage((payload) => {
    const notification = payload.notification || {};
    self.registration.showNotification(notification.title || 'Notification', {
      body: notification.body || '',
      data: payload.data || {},
    });
  });
}

// Focus (or open) the app when a notification is clicked.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow('/notifications');
    }),
  );
});
`;

  return new Response(body, {
    headers: {
      "content-type": "application/javascript; charset=utf-8",
      "cache-control": "no-cache, no-store, must-revalidate",
    },
  });
}
