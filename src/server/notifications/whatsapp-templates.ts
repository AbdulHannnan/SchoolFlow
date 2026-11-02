import "server-only";

import type { NotificationType } from "@prisma/client";

import type { NotificationMessage } from "@/server/notifications/types";

/**
 * WhatsApp utility templates (Module 4.3).
 *
 * Business-initiated WhatsApp messages must use a template pre-approved in the
 * Meta WhatsApp Business account — free-form text is not allowed outside the
 * 24-hour customer-service window. So only the notification types listed here
 * can be sent over WhatsApp; the channel skips any type without an entry (e.g.
 * GENERAL). Template `name`/`languageCode` must match what's approved in Meta;
 * both can be overridden by env so the same code works across accounts.
 */

export type WhatsAppTemplate = {
  /** Template name exactly as approved in the WhatsApp Business account. */
  name: string;
  /** BCP-47 language code of the approved template (e.g. "en", "ur"). */
  languageCode: string;
  /** Ordered body parameters ({{1}}, {{2}}, …) built from the message. */
  buildBodyParameters: (message: NotificationMessage) => string[];
};

/** Read a string field from a notification's `data` payload, or null. */
function dataString(data: NotificationMessage["data"], key: string): string | null {
  const value = data?.[key];
  return typeof value === "string" ? value : null;
}

export const WHATSAPP_TEMPLATES: Partial<Record<NotificationType, WhatsAppTemplate>> = {
  // Approved body, e.g.: "Dear parent, {{1}} was marked absent on {{2}}.
  // Please contact the school." Module 4.6 populates `data.studentName` and
  // `data.date` when it emits this event.
  ATTENDANCE_ABSENT: {
    name: process.env.WHATSAPP_TEMPLATE_ATTENDANCE_ABSENT ?? "attendance_absent",
    languageCode: process.env.WHATSAPP_TEMPLATE_LANGUAGE ?? "en",
    buildBodyParameters: (message) => [
      dataString(message.data, "studentName") ?? message.title,
      dataString(message.data, "date") ?? "",
    ],
  },
  // Approved body, e.g.: "Dear parent, {{1}} has an outstanding fee of {{2}}.
  // Please clear it at the school office." Module 6.4 populates `data.studentName`
  // and `data.amount` (a display-ready PKR string) when it emits this event.
  FEE_REMINDER: {
    name: process.env.WHATSAPP_TEMPLATE_FEE_REMINDER ?? "fee_reminder",
    languageCode: process.env.WHATSAPP_TEMPLATE_LANGUAGE ?? "en",
    buildBodyParameters: (message) => [
      dataString(message.data, "studentName") ?? message.title,
      dataString(message.data, "amount") ?? "",
    ],
  },
  // Approved body, e.g.: "Weekly report for {{1}} (week of {{2}}).
  // Attendance: {{3}}. Performance: {{4}}. Red flags: {{5}}." The HEAD-initiated
  // weekly-report flow populates data.studentName, data.weekLabel,
  // data.attendance, data.performance and data.redFlags when it emits the event.
  WEEKLY_REPORT: {
    name: process.env.WHATSAPP_TEMPLATE_WEEKLY_REPORT ?? "weekly_report",
    languageCode: process.env.WHATSAPP_TEMPLATE_LANGUAGE ?? "en",
    buildBodyParameters: (message) => [
      dataString(message.data, "studentName") ?? message.title,
      dataString(message.data, "weekLabel") ?? "",
      dataString(message.data, "attendance") ?? "",
      dataString(message.data, "performance") ?? "",
      dataString(message.data, "redFlags") ?? "",
    ],
  },
};
