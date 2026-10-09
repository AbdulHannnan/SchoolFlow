import "server-only";

import type { NotificationType, Prisma } from "@prisma/client";

import { prisma } from "@/server/db";
import { withTenant } from "@/server/db/tenant";
import { deliverMessages } from "@/server/notifications/dispatch";
import type { ChannelName, NotificationMessage } from "@/server/notifications/types";

/**
 * Scheduled / batched sends (Module 4.5).
 *
 * The notification engine (Module 4.1) delivers an event immediately. Some
 * sends should instead happen later or in a batch — a fee reminder the morning
 * it's due (Module 6.4), a daily attendance digest. Those callers `enqueue` a
 * row into the scheduled-notification outbox; the scheduler's per-minute cron
 * flush (`src/server/scheduler`) picks up every row that has come due and
 * delivers it through the same channels, then stamps `sentAt`.
 *
 * Enqueue runs in a request/tenant context, so it writes through `withTenant`
 * (RLS-enforced). The flush runs in a cron context with no session and spans
 * every tenant, so it reads/stamps the outbox with the owner client (which
 * bypasses RLS by design, like auth and SUPER_ADMIN ops); tenant-scoped
 * delivery still happens per-school inside each channel.
 */

/** Max rows one flush tick drains, to bound work per minute. */
const FLUSH_BATCH_SIZE = 200;

const DEFAULT_CHANNELS: ChannelName[] = ["in-app"];

/**
 * Queue a notification for delivery at `sendAt` (one outbox row per recipient).
 * Pass a past or current `sendAt` to have the next flush send it right away.
 */
export async function enqueueScheduledNotification(input: {
  schoolId: string;
  recipientIds: string[];
  title: string;
  body: string;
  sendAt: Date;
  type?: NotificationType;
  data?: Record<string, unknown> | null;
  channels?: ChannelName[];
}): Promise<void> {
  const { schoolId, recipientIds, title, body, sendAt } = input;
  if (recipientIds.length === 0) return;

  const type = input.type ?? "GENERAL";
  const channels = input.channels ?? DEFAULT_CHANNELS;
  const data = input.data == null ? undefined : (input.data as Prisma.InputJsonValue);

  await withTenant(schoolId, (tx) =>
    tx.scheduledNotification.createMany({
      data: recipientIds.map((recipientId) => ({
        schoolId,
        recipientId,
        type,
        title,
        body,
        data,
        channels,
        sendAt,
      })),
    }),
  );
}

export type FlushResult = {
  /** Rows picked up this tick (due and unsent). */
  processed: number;
  /** Rows dispatched and stamped `sentAt`. */
  delivered: number;
  /** Rows left unsent after an unexpected failure (retried next tick). */
  failed: number;
};

/**
 * Deliver every scheduled notification whose `sendAt` has passed and that is
 * not yet sent, oldest first. Called by the scheduler's cron job; also safe to
 * invoke directly (e.g. from a verification script). `now` is injectable for
 * tests.
 *
 * Channel failures are already isolated inside `deliverMessages`, so a row is
 * stamped `sentAt` once it has been handed to the channels. The surrounding
 * try/catch only guards against catastrophic failures (e.g. the database being
 * unreachable); those rows stay unsent and are retried on the next tick.
 */
export async function flushDueScheduledNotifications(now: Date = new Date()): Promise<FlushResult> {
  const due = await prisma.scheduledNotification.findMany({
    where: { sentAt: null, sendAt: { lte: now } },
    orderBy: { sendAt: "asc" },
    take: FLUSH_BATCH_SIZE,
  });

  let delivered = 0;
  let failed = 0;

  for (const row of due) {
    const message: NotificationMessage = {
      recipientId: row.recipientId,
      type: row.type,
      title: row.title,
      body: row.body,
      data: (row.data as Record<string, unknown> | null) ?? null,
    };
    const targets = (row.channels.length > 0 ? row.channels : DEFAULT_CHANNELS) as ChannelName[];

    try {
      await deliverMessages(row.schoolId, [message], targets);
      await prisma.scheduledNotification.update({
        where: { id: row.id },
        data: { sentAt: new Date(), attempts: { increment: 1 }, lastError: null },
      });
      delivered++;
    } catch (err) {
      failed++;
      const detail = err instanceof Error ? err.message : String(err);
      await prisma.scheduledNotification
        .update({
          where: { id: row.id },
          data: { attempts: { increment: 1 }, lastError: detail.slice(0, 500) },
        })
        .catch(() => {
          /* best-effort bookkeeping; the row simply retries next tick */
        });
      console.error(`[scheduler] scheduled notification ${row.id} failed`, err);
    }
  }

  return { processed: due.length, delivered, failed };
}
