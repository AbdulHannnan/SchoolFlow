"use client";

import { useEffect, useState } from "react";
import { Bell, BellRing, Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { registerPushTokenAction } from "@/app/notifications/actions";

type State = "checking" | "unsupported" | "idle" | "enabling" | "enabled" | "denied" | "error";

/**
 * Lets a user turn on Web Push (FCM) for the current browser (Module 4.4):
 * requests permission, registers the service worker, gets an FCM token, and
 * stores it via a Server Action. Renders nothing when push isn't available
 * (no Firebase config, or an unsupported browser), so it's safe to always mount.
 */
export function EnablePushButton() {
  const [state, setState] = useState<State>("checking");

  useEffect(() => {
    let active = true;
    (async () => {
      if (!("Notification" in window) || !("serviceWorker" in navigator)) {
        if (active) setState("unsupported");
        return;
      }
      const { isPushSupported } = await import("@/lib/firebase-client");
      if (!(await isPushSupported())) {
        if (active) setState("unsupported");
        return;
      }
      if (!active) return;
      if (Notification.permission === "granted") setState("enabled");
      else if (Notification.permission === "denied") setState("denied");
      else setState("idle");
    })();
    return () => {
      active = false;
    };
  }, []);

  async function enable() {
    setState("enabling");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "idle");
        return;
      }
      const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
      const { requestFcmToken } = await import("@/lib/firebase-client");
      const token = await requestFcmToken(registration);
      if (!token) {
        setState("error");
        return;
      }
      const formData = new FormData();
      formData.set("token", token);
      formData.set("userAgent", navigator.userAgent);
      await registerPushTokenAction(formData);
      setState("enabled");
    } catch (error) {
      console.error("[push] enable failed", error);
      setState("error");
    }
  }

  if (state === "checking" || state === "unsupported") return null;

  if (state === "enabled") {
    return (
      <span className="text-muted-foreground inline-flex items-center gap-1.5 text-sm">
        <Check className="size-4" />
        Push enabled on this device
      </span>
    );
  }

  if (state === "denied") {
    return (
      <span className="text-muted-foreground text-sm">
        Push is blocked in your browser settings.
      </span>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={enable}
        disabled={state === "enabling"}
      >
        {state === "enabling" ? (
          <>
            <BellRing className="animate-pulse" />
            Enabling...
          </>
        ) : (
          <>
            <Bell />
            Enable push on this device
          </>
        )}
      </Button>
      {state === "error" ? (
        <span role="alert" className="text-destructive text-sm">
          Could not enable push. Please try again.
        </span>
      ) : null}
    </div>
  );
}
