import "server-only";

import { requireSchool } from "@/server/auth/dal";
import { withTenant } from "@/server/db/tenant";

/**
 * Notifications read model (Module 4.1): the signed-in user's in-app inbox.
 * Every query is scoped to the recipient AND the tenant (RLS), so a user only
 * ever sees — and can only ever mark read — their own notifications.
 */

const INBOX_LIMIT = 50;

/** The caller's most recent notifications (newest first). */
export async function listMyNotifications() {
  const { user, schoolId } = await requireSchool();
  return withTenant(schoolId, (tx) =>
    tx.notification.findMany({
      where: { recipientId: user.id },
      orderBy: { createdAt: "desc" },
      take: INBOX_LIMIT,
      select: {
        id: true,
        type: true,
        title: true,
        body: true,
        data: true,
        readAt: true,
        createdAt: true,
      },
    }),
  );
}

/** How many of the caller's notifications are unread (for the header badge). */
export async function countMyUnread(): Promise<number> {
  const { user, schoolId } = await requireSchool();
  return withTenant(schoolId, (tx) =>
    tx.notification.count({ where: { recipientId: user.id, readAt: null } }),
  );
}

/**
 * Mark one of the caller's notifications read (idempotent). The `id` comes from
 * the client and is untrusted, so the update is scoped by `recipientId`: a user
 * can never mark someone else's notification read, even with a valid id.
 */
export async function markNotificationRead(id: string): Promise<void> {
  const { user, schoolId } = await requireSchool();
  await withTenant(schoolId, (tx) =>
    tx.notification.updateMany({
      where: { id, recipientId: user.id, readAt: null },
      data: { readAt: new Date() },
    }),
  );
}

/** Mark all of the caller's unread notifications read. */
export async function markAllNotificationsRead(): Promise<void> {
  const { user, schoolId } = await requireSchool();
  await withTenant(schoolId, (tx) =>
    tx.notification.updateMany({
      where: { recipientId: user.id, readAt: null },
      data: { readAt: new Date() },
    }),
  );
}
