import "server-only";

import { emailChannel } from "@/server/notifications/channels/email";
import { inAppChannel } from "@/server/notifications/channels/in-app";
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

/** An occurrence worth notifying someone about. The union grows per module —
 * e.g. Module 4.6 adds the attendance "absent" alert fanned out to a student's
 * parents, Module 5 adds homework posts, Module 6 adds fee reminders. */
export type AppEvent = {
  type: "GENERAL";
  schoolId: string;
  recipientIds: string[];
  title: string;
  body: string;
  data?: Record<string, unknown> | null;
  /** Channels to deliver on. Defaults to in-app only; opt into email (4.2) and,
   * later, WhatsApp/push per event so external sends are deliberate. */
  channels?: ChannelName[];
};

/** Every implemented channel, keyed by name for per-event targeting. */
const channels: NotificationChannel[] = [inAppChannel, emailChannel, whatsappChannel];

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
  }
}

/**
 * Dispatch an event to every enabled channel. Channels are isolated with
 * `allSettled`: one channel failing (say, an email provider is down) never
 * blocks the others, so the in-app notification still lands.
 */
export async function dispatch(event: AppEvent): Promise<void> {
  const messages = renderEvent(event);
  if (messages.length === 0) return;

  const targets = event.channels ?? DEFAULT_CHANNELS;
  const active = channels.filter((channel) => targets.includes(channel.name));

  const results = await Promise.allSettled(
    active.map((channel) => channel.deliver(event.schoolId, messages)),
  );
  results.forEach((result, i) => {
    if (result.status === "rejected") {
      console.error(`[notifications] channel "${active[i].name}" failed`, result.reason);
    }
  });
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
