import "server-only";

import { emailChannel } from "@/server/notifications/channels/email";
import { inAppChannel } from "@/server/notifications/channels/in-app";
import { webPushChannel } from "@/server/notifications/channels/web-push";
import { whatsappChannel } from "@/server/notifications/channels/whatsapp";
import type {
  ChannelName,
  NotificationChannel,
  NotificationMessage,
} from "@/server/notifications/types";

/**
 * Notification engine dispatcher (Module 4.1).
 *
 * A domain event is independent of how — or whether — it gets delivered.
 * Modules emit events; the dispatcher expands one event into a message per
 * recipient and hands those to every enabled channel. This is the seam that
 * keeps the rest of the app channel-agnostic: new channels (email 4.2, WhatsApp
 * 4.3, web push 4.4) register below and new event kinds join the union, with no
 * change to the code that emits events.
 */

/** Fields every event carries: the tenant, the recipients, and the channels to
 * deliver on. Channels default to in-app only; events opt into email (4.2),
 * WhatsApp (4.3) and push (4.4) per occurrence so external sends are deliberate. */
type BaseEvent = {
  schoolId: string;
  recipientIds: string[];
  channels?: ChannelName[];
};

/** An occurrence worth notifying someone about. The union grows per module —
 * Module 4.6 adds the attendance "absent" alert fanned out to a student's
 * parents; Module 5 adds homework posts, Module 6 adds fee reminders. */
export type AppEvent =
  | (BaseEvent & {
      type: "GENERAL";
      title: string;
      body: string;
      data?: Record<string, unknown> | null;
    })
  | (BaseEvent & {
      /** A student was marked absent (Module 4.6). Recipients are the student's
       * linked parents. Carries the student and date so the WhatsApp template
       * (and any deep link) can be rendered without another lookup. */
      type: "ATTENDANCE_ABSENT";
      studentId: string;
      studentName: string;
      /** Human-readable date the absence was recorded for (e.g. "09 Oct 2026"). */
      date: string;
    });

/** Every implemented channel, keyed by name for per-event targeting. */
const channels: NotificationChannel[] = [
  inAppChannel,
  emailChannel,
  whatsappChannel,
  webPushChannel,
];

/** Channels an event reaches when it doesn't name any. */
const DEFAULT_CHANNELS: ChannelName[] = ["in-app"];

/** Expand one event into a channel-agnostic message per recipient. */
function renderEvent(event: AppEvent): NotificationMessage[] {
  switch (event.type) {
    case "GENERAL":
      return event.recipientIds.map((recipientId) => ({
        recipientId,
        type: "GENERAL",
        title: event.title,
        body: event.body,
        data: event.data ?? null,
      }));
    case "ATTENDANCE_ABSENT":
      return event.recipientIds.map((recipientId) => ({
        recipientId,
        type: "ATTENDANCE_ABSENT",
        title: `${event.studentName} was marked absent`,
        body: `${event.studentName} was marked absent on ${event.date}. Please contact the school if this is unexpected.`,
        // Keys consumed by the WhatsApp template (studentName, date); studentId
        // is kept for an in-app deep link to the child's attendance.
        data: { studentId: event.studentId, studentName: event.studentName, date: event.date },
      }));
  }
}

/**
 * Deliver already-rendered messages to every targeted channel for one school.
 * This is the shared core beneath `dispatch`: callers that already hold
 * channel-agnostic messages — e.g. the scheduler draining the scheduled-send
 * queue (Module 4.5), where each queued row carries its own type — deliver
 * through here without going via the event union. Channels are isolated with
 * `allSettled`: one channel failing (say, an email provider is down) never
 * blocks the others, so the in-app notification still lands.
 */
export async function deliverMessages(
  schoolId: string,
  messages: NotificationMessage[],
  targets: ChannelName[] = DEFAULT_CHANNELS,
): Promise<void> {
  if (messages.length === 0) return;

  const active = channels.filter((channel) => targets.includes(channel.name));

  const results = await Promise.allSettled(
    active.map((channel) => channel.deliver(schoolId, messages)),
  );
  results.forEach((result, i) => {
    if (result.status === "rejected") {
      console.error(`[notifications] channel "${active[i].name}" failed`, result.reason);
    }
  });
}

/**
 * Dispatch an event to every enabled channel. Expands the event into one
 * message per recipient, then hands them to `deliverMessages`.
 */
export async function dispatch(event: AppEvent): Promise<void> {
  await deliverMessages(event.schoolId, renderEvent(event), event.channels ?? DEFAULT_CHANNELS);
}

/** Convenience wrapper: send an ad-hoc message to one or more users. Defaults
 * to the in-app channel; pass `channels` to also send email (etc.). */
export async function notifyUsers(input: {
  schoolId: string;
  recipientIds: string[];
  title: string;
  body: string;
  data?: Record<string, unknown> | null;
  channels?: ChannelName[];
}): Promise<void> {
  await dispatch({ type: "GENERAL", ...input });
}
