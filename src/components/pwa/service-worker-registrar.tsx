"use client";

import { useEffect } from "react";

/**
 * Registers the app's root-scope service worker (`/firebase-messaging-sw.js`)
 * for every visitor once the page has loaded (Module 10.1). A registered worker
 * with a fetch handler is what makes the app installable and provides the
 * offline fallback; the push opt-in flow (EnablePushButton) re-registers the
 * same URL, which is idempotent.
 *
 * Renders nothing. Registration is best-effort and silent on unsupported
 * browsers or failures so it never affects the UI.
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const register = () => {
      navigator.serviceWorker.register("/firebase-messaging-sw.js").catch((error) => {
        console.error("[pwa] service worker registration failed", error);
      });
    };
    if (document.readyState === "complete") {
      register();
    } else {
      window.addEventListener("load", register, { once: true });
      return () => window.removeEventListener("load", register);
    }
  }, []);

  return null;
}
