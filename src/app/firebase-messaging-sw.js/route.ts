/**
 * Serves the app's single root-scope service worker at `/firebase-messaging-sw.js`.
 *
 * It does two jobs:
 *  - Firebase Cloud Messaging / Web Push (Module 4.4). The public Firebase config
 *    is injected from the environment at request time; with no config the push
 *    code stays inert, keeping local dev push-free but functional.
 *  - PWA app shell (Module 10.1): a fetch handler with an offline fallback for
 *    navigations. This is also what makes the app installable, so the worker is
 *    now registered for every visitor (see ServiceWorkerRegistrar), not just when
 *    a user opts into push.
 *
 * It's a route handler rather than a static /public file so the config can be
 * injected per request. Only one service worker can control scope "/", so both
 * responsibilities live here.
 */

// Compat SDK is used inside the worker (modular SDK has no service-worker build).
const FIREBASE_SDK_VERSION = "10.12.0";

// Bump to invalidate the cached offline page on the next SW update.
const SHELL_CACHE = "school-shell-v1";

export async function GET(): Promise<Response> {
  const config = process.env.NEXT_PUBLIC_FIREBASE_CONFIG ?? "null";

  const body = `importScripts('https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}/firebase-messaging-compat.js');

// --- PWA app shell (Module 10.1) ---
const SHELL_CACHE = ${JSON.stringify(SHELL_CACHE)};
const OFFLINE_URL = '/__offline';
const OFFLINE_HTML = ${JSON.stringify(offlineHtml())};

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) =>
      cache.put(
        OFFLINE_URL,
        new Response(OFFLINE_HTML, { headers: { 'content-type': 'text/html; charset=utf-8' } }),
      ),
    ),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== SHELL_CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

// Network-first for page navigations; fall back to the offline page when the
// network is unavailable. Non-navigation and non-GET requests (assets, API,
// Server Actions, tenant data) are left to the browser so nothing is cached.
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || req.mode !== 'navigate') return;
  event.respondWith(fetch(req).catch(() => caches.match(OFFLINE_URL)));
});

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

/**
 * Minimal, self-contained offline page served by the SW when a navigation fails
 * with no network. Kept inline (no external assets) so it works fully offline,
 * and theme-aware to match the app in light and dark.
 */
function offlineHtml(): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Offline - School Management</title>
<style>
  :root { color-scheme: light dark; }
  html, body { height: 100%; margin: 0; }
  body {
    display: flex; align-items: center; justify-content: center;
    font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
    background: #ffffff; color: #1a1a1a; padding: 24px;
  }
  @media (prefers-color-scheme: dark) {
    body { background: #1a1a1a; color: #fafafa; }
  }
  .card { max-width: 360px; text-align: center; }
  h1 { font-size: 1.25rem; margin: 0 0 8px; }
  p { margin: 0 0 20px; opacity: 0.75; line-height: 1.5; }
  button {
    font: inherit; cursor: pointer; border: 0; border-radius: 8px;
    padding: 10px 18px; background: #1a1a1a; color: #fff;
  }
  @media (prefers-color-scheme: dark) {
    button { background: #fafafa; color: #1a1a1a; }
  }
</style>
</head>
<body>
  <div class="card">
    <h1>You're offline</h1>
    <p>School Management needs a connection to load this page. Check your network and try again.</p>
    <button onclick="location.reload()">Retry</button>
  </div>
</body>
</html>`;
}
