import "server-only";

import type { Prisma } from "@prisma/client";

import { withTenant } from "@/server/db/tenant";
import type { NotificationChannel } from "@/server/notifications/types";

/**
 * In-app channel (Module 4.1): persists one `Notification` row per recipient.
 * Writes go through `withTenant`, so RLS pins every row to the acting school.
 */
export const inAppChannel: NotificationChannel = {
  name: "in-app",
  async deliver(schoolId, messages) {
    if (messages.length === 0) return;
    await withTenant(schoolId, (tx) =>
      tx.notification.createMany({
        data: messages.map((m) => ({
          schoolId,
          recipientId: m.recipientId,
          type: m.type,
          title: m.title,
          body: m.body,
          data: m.data == null ? undefined : (m.data as Prisma.InputJsonValue),
        })),
      }),
    );
  },
};
