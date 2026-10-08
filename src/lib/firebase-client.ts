import { getApp, getApps, initializeApp } from "firebase/app";
import { getMessaging, getToken, isSupported, type Messaging } from "firebase/messaging";

/**
 * Client-side Firebase helpers for Web Push (Module 4.4). Loaded only from the
 * browser (dynamically imported by the enable-push button), never on the
 * server. Everything is gated on `NEXT_PUBLIC_FIREBASE_CONFIG`: with it unset,
 * or in a browser without the required APIs, these return null so the UI can
 * degrade gracefully.
 */

function readConfig(): Record<string, unknown> | null {
  const raw = process.env.NEXT_PUBLIC_FIREBASE_CONFIG;
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function getMessagingIfSupported(): Promise<Messaging | null> {
  const config = readConfig();
  if (!config) return null;
  if (!(await isSupported())) return null;
  const app = getApps().length > 0 ? getApp() : initializeApp(config);
  return getMessaging(app);
}

/** Whether Web Push can be offered in this browser with the current config. */
export async function isPushSupported(): Promise<boolean> {
  return (await getMessagingIfSupported()) !== null;
}

/**
 * Request an FCM registration token for this browser, bound to the given
 * service-worker registration. Returns null when push isn't available.
 */
export async function requestFcmToken(
  registration: ServiceWorkerRegistration,
): Promise<string | null> {
  const messaging = await getMessagingIfSupported();
  if (!messaging) return null;
  const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
  const token = await getToken(messaging, { vapidKey, serviceWorkerRegistration: registration });
  return token || null;
}
