import "server-only";

import { withTenant } from "@/server/db/tenant";
import {
  WHATSAPP_TEMPLATES,
  type WhatsAppTemplate,
} from "@/server/notifications/whatsapp-templates";
import type { NotificationChannel } from "@/server/notifications/types";

/**
 * WhatsApp channel (Module 4.3), backed by the WhatsApp Cloud API.
 *
 * Event-triggered and template-only by design: a message is sent only if its
 * type maps to an approved utility template (see `whatsapp-templates.ts`), so
 * free-form types are skipped. Dev-safe: with the Cloud API env unset it logs a
 * skip and returns. Recipient phone numbers are resolved through `withTenant`
 * (RLS), never trusted from the caller; per-recipient failures are collected so
 * one bad number doesn't drop the rest.
 */

type WhatsAppConfig = { phoneNumberId: string; accessToken: string; apiVersion: string };

const DEFAULT_API_VERSION = "v21.0";

function getConfig(): WhatsAppConfig | null {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!phoneNumberId || !accessToken) return null;
  return {
    phoneNumberId,
    accessToken,
    apiVersion: process.env.WHATSAPP_API_VERSION ?? DEFAULT_API_VERSION,
  };
}

async function sendTemplate(
  config: WhatsAppConfig,
  to: string,
  template: WhatsAppTemplate,
  bodyParameters: string[],
): Promise<void> {
  const url = `https://graph.facebook.com/${config.apiVersion}/${config.phoneNumberId}/messages`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      authorization: `Bearer ${config.accessToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "template",
      template: {
        name: template.name,
        language: { code: template.languageCode },
        components:
          bodyParameters.length > 0
            ? [{ type: "body", parameters: bodyParameters.map((text) => ({ type: "text", text })) }]
            : [],
      },
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`WhatsApp send failed (${res.status}): ${detail.slice(0, 200)}`);
  }
}

export const whatsappChannel: NotificationChannel = {
  name: "whatsapp",
  async deliver(schoolId, messages) {
    if (messages.length === 0) return;

    const config = getConfig();
    if (!config) {
      console.warn(
        "[notifications] whatsapp channel skipped: set WHATSAPP_PHONE_NUMBER_ID and WHATSAPP_ACCESS_TOKEN to enable",
      );
      return;
    }

    // Only messages whose type has an approved template can be sent.
    const sendable = messages.filter((m) => WHATSAPP_TEMPLATES[m.type]);
    const skipped = messages.length - sendable.length;
    if (skipped > 0) {
      console.warn(
        `[notifications] whatsapp: ${skipped} message(s) skipped (no approved template for their type)`,
      );
    }
    if (sendable.length === 0) return;

    const recipientIds = [...new Set(sendable.map((m) => m.recipientId))];
    const users = await withTenant(schoolId, (tx) =>
      tx.user.findMany({
        where: { id: { in: recipientIds }, isActive: true },
        select: { id: true, phone: true },
      }),
    );
    const phoneById = new Map(users.map((u) => [u.id, u.phone]));

    const failures: unknown[] = [];
    for (const message of sendable) {
      const phone = phoneById.get(message.recipientId);
      if (!phone) continue;
      const template = WHATSAPP_TEMPLATES[message.type]!;
      try {
        await sendTemplate(config, phone, template, template.buildBodyParameters(message));
      } catch (error) {
        failures.push(error);
      }
    }

    if (failures.length > 0) {
      throw new AggregateError(failures, `whatsapp channel: ${failures.length} send(s) failed`);
    }
  },
};
