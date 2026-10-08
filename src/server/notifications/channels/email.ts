import "server-only";

import { withTenant } from "@/server/db/tenant";
import { renderEmail, type EmailContent } from "@/server/notifications/templates";
import type { NotificationChannel } from "@/server/notifications/types";

/**
 * Email channel (Module 4.2), backed by Brevo's transactional email API.
 *
 * Dev-safe: with `BREVO_API_KEY`/`EMAIL_FROM` unset it logs a skip and returns,
 * so the notification engine keeps working locally without a provider. Recipient
 * addresses are resolved through `withTenant` (RLS), never trusted from the
 * caller. Per-recipient send failures are collected so one bad address doesn't
 * drop the rest; the dispatcher then isolates the channel as a whole.
 */

type Sender = { email: string; name: string };

const BREVO_ENDPOINT = "https://api.brevo.com/v3/smtp/email";

function getConfig(): { apiKey: string; sender: Sender } | null {
  const apiKey = process.env.BREVO_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) return null;
  return {
    apiKey,
    sender: { email: from, name: process.env.EMAIL_FROM_NAME ?? "School Management" },
  };
}

async function sendViaBrevo(
  apiKey: string,
  sender: Sender,
  to: { email: string; name: string },
  content: EmailContent,
): Promise<void> {
  const res = await fetch(BREVO_ENDPOINT, {
    method: "POST",
    headers: {
      "api-key": apiKey,
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({
      sender,
      to: [to],
      subject: content.subject,
      htmlContent: content.html,
      textContent: content.text,
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Brevo send failed (${res.status}): ${detail.slice(0, 200)}`);
  }
}

export const emailChannel: NotificationChannel = {
  name: "email",
  async deliver(schoolId, messages) {
    if (messages.length === 0) return;

    const config = getConfig();
    if (!config) {
      console.warn(
        "[notifications] email channel skipped: set BREVO_API_KEY and EMAIL_FROM to enable",
      );
      return;
    }

    const recipientIds = [...new Set(messages.map((m) => m.recipientId))];
    const users = await withTenant(schoolId, (tx) =>
      tx.user.findMany({
        where: { id: { in: recipientIds }, isActive: true },
        select: { id: true, email: true, name: true },
      }),
    );
    const byId = new Map(users.map((u) => [u.id, u]));

    const failures: unknown[] = [];
    for (const message of messages) {
      const user = byId.get(message.recipientId);
      if (!user?.email) continue;
      try {
        await sendViaBrevo(
          config.apiKey,
          config.sender,
          { email: user.email, name: user.name },
          renderEmail(message),
        );
      } catch (error) {
        failures.push(error);
      }
    }

    if (failures.length > 0) {
      throw new AggregateError(failures, `email channel: ${failures.length} send(s) failed`);
    }
  },
};
