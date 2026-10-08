import "server-only";

import type { NotificationType } from "@prisma/client";

import type { NotificationMessage } from "@/server/notifications/types";

/**
 * Email templates (Module 4.2). A notification message is rendered into an
 * email (subject + HTML + plain text) here, independent of the transport. Each
 * `NotificationType` may override the default copy; unlisted types fall back to
 * the message's own title/body. Keeping this separate from the Brevo channel
 * means WhatsApp/push can render their own copy from the same messages later.
 */

export type EmailContent = { subject: string; html: string; text: string };

const APP_NAME = "School Management";

/** Per-type overrides layered on top of the message's title/body. */
const TEMPLATES: Partial<Record<NotificationType, { intro: string }>> = {
  ATTENDANCE_ABSENT: {
    intro: "This is an attendance alert from your school.",
  },
};

function appUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return `${base.replace(/\/$/, "")}${path}`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function layout(title: string, bodyHtml: string): string {
  return [
    `<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#0f172a">`,
    `<h2 style="margin:0 0 16px;font-size:18px">${escapeHtml(title)}</h2>`,
    bodyHtml,
    `<hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0" />`,
    `<p style="font-size:12px;color:#64748b;margin:0">You received this email from ${APP_NAME}.</p>`,
    `</div>`,
  ].join("");
}

export function renderEmail(message: NotificationMessage): EmailContent {
  const link = appUrl("/notifications");
  const intro = TEMPLATES[message.type]?.intro;

  const paragraphs = [intro, message.body].filter(Boolean) as string[];
  const bodyHtml = [
    ...paragraphs.map((p) => `<p style="margin:0 0 12px;line-height:1.5">${escapeHtml(p)}</p>`),
    `<p style="margin:16px 0 0"><a href="${link}" style="color:#2563eb">View in ${APP_NAME}</a></p>`,
  ].join("");

  const text = [...paragraphs, "", `View: ${link}`].join("\n");

  return { subject: message.title, html: layout(message.title, bodyHtml), text };
}
