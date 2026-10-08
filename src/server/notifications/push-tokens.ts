import "server-only";

import { requireSchool } from "@/server/auth/dal";
import { withTenant } from "@/server/db/tenant";

/**
 * Web Push token registration (Module 4.4). Each FCM registration token is
 * bound to the signed-in user within their tenant; the web-push channel resolves
 * tokens the same way. Writes go through `withTenant` so RLS pins every row.
 */

/** Save (or re-bind) an FCM token for the current user. Idempotent per token. */
export async function registerPushToken(input: {
  token: string;
  userAgent?: string | null;
}): Promise<void> {
  const { user, schoolId } = await requireSchool();
  const token = input.token.trim();
  if (!token) return;
  const userAgent = input.userAgent?.slice(0, 255) ?? null;
  await withTenant(schoolId, (tx) =>
    tx.pushSubscription.upsert({
      where: { schoolId_token: { schoolId, token } },
      create: { schoolId, recipientId: user.id, token, userAgent },
      // A token can move between accounts on a shared browser — re-bind it.
      update: { recipientId: user.id, userAgent },
    }),
  );
}

/** Remove an FCM token for the current user (e.g. on explicit disable). */
export async function unregisterPushToken(token: string): Promise<void> {
  const { user, schoolId } = await requireSchool();
  const value = token.trim();
  if (!value) return;
  await withTenant(schoolId, (tx) =>
    tx.pushSubscription.deleteMany({ where: { schoolId, token: value, recipientId: user.id } }),
  );
}
