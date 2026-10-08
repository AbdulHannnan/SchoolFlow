"use server";

import { refresh } from "next/cache";

import { requireSchool } from "@/server/auth/dal";
import {
  markAllNotificationsRead,
  markNotificationRead,
} from "@/server/notifications/notifications";
import { registerPushToken, unregisterPushToken } from "@/server/notifications/push-tokens";

/**
 * Notifications Server Actions (Module 4.1). Any tenant user may manage their
 * own inbox; `requireSchool` is the authorization boundary and the read model
 * scopes every write to the caller. `refresh()` re-renders the current route so
 * the inbox and the header badge update in the same response.
 */

export async function markReadAction(formData: FormData): Promise<void> {
  await requireSchool();
  const id = String(formData.get("id") ?? "");
  if (id) {
    await markNotificationRead(id);
    refresh();
  }
}

export async function markAllReadAction(): Promise<void> {
  await requireSchool();
  await markAllNotificationsRead();
  refresh();
}

/** Store this browser's FCM token for the signed-in user (Module 4.4). */
export async function registerPushTokenAction(formData: FormData): Promise<void> {
  await requireSchool();
  const token = String(formData.get("token") ?? "");
  const userAgent = String(formData.get("userAgent") ?? "");
  if (token) {
    await registerPushToken({ token, userAgent });
  }
}

/** Remove this browser's FCM token for the signed-in user. */
export async function unregisterPushTokenAction(formData: FormData): Promise<void> {
  await requireSchool();
  const token = String(formData.get("token") ?? "");
  if (token) {
    await unregisterPushToken(token);
  }
}
