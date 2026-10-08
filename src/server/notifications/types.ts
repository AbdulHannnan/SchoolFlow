import "server-only";

import type { NotificationType } from "@prisma/client";

/**
 * Notification engine shared types (Module 4.1).
 *
 * A `NotificationMessage` is a recipient-ready message produced from a domain
 * event, before any channel delivers it. It is channel-agnostic: every channel
 * receives the same messages and decides how to deliver them.
 */
export type NotificationMessage = {
  recipientId: string;
  type: NotificationType;
  title: string;
  body: string;
  /** Structured context for rendering/deep-linking (persisted as JSON). */
  data?: Record<string, unknown> | null;
};

/**
 * Known delivery channels. Grows as channels land: in-app (4.1), email (4.2);
 * WhatsApp (4.3) and web push (4.4) add their names here when implemented.
 */
export type ChannelName = "in-app" | "email";

/**
 * A delivery channel. In-app and email exist today; WhatsApp (4.3) and web push
 * (4.4) implement this same interface and register with the dispatcher without
 * any caller changing.
 */
export interface NotificationChannel {
  readonly name: ChannelName;
  /** Deliver every message for one school. The dispatcher isolates failures,
   * so a throw here never stops the other channels from delivering. */
  deliver(schoolId: string, messages: NotificationMessage[]): Promise<void>;
}
