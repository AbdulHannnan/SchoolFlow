import "server-only";

import crypto from "node:crypto";

import { withTenant } from "@/server/db/tenant";
import type { NotificationChannel, NotificationMessage } from "@/server/notifications/types";

/**
 * Web Push channel (Module 4.4), backed by Firebase Cloud Messaging's HTTP v1
 * API. Authentication is a short-lived OAuth2 access token minted from a service
 * account (JWT signed with the account's private key), cached per instance.
 *
 * Dev-safe: with `FIREBASE_SERVICE_ACCOUNT_KEY` unset it logs a skip and
 * returns. Recipient tokens are resolved through `withTenant` (RLS). Tokens FCM
 * reports as unregistered are pruned so the table self-heals; other per-send
 * failures are collected and the dispatcher isolates the channel.
 */

type ServiceAccount = { projectId: string; clientEmail: string; privateKey: string };

const OAUTH_ENDPOINT = "https://oauth2.googleapis.com/token";
const FCM_SCOPE = "https://www.googleapis.com/auth/firebase.messaging";

function appUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return `${base.replace(/\/$/, "")}${path}`;
}

/** Parse the service account from env (raw JSON or base64-encoded JSON). */
function getServiceAccount(): ServiceAccount | null {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!raw) return null;
  const json = raw.trim().startsWith("{") ? raw : safeBase64Decode(raw);
  if (!json) return null;
  try {
    const parsed = JSON.parse(json) as {
      project_id?: string;
      client_email?: string;
      private_key?: string;
    };
    if (!parsed.project_id || !parsed.client_email || !parsed.private_key) return null;
    return {
      projectId: parsed.project_id,
      clientEmail: parsed.client_email,
      privateKey: parsed.private_key,
    };
  } catch {
    return null;
  }
}

function safeBase64Decode(value: string): string | null {
  try {
    return Buffer.from(value, "base64").toString("utf8");
  } catch {
    return null;
  }
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

// OAuth access-token cache, shared across sends within one server instance.
let cachedToken: { value: string; expiresAt: number } | null = null;

async function getAccessToken(sa: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.expiresAt > now + 60) return cachedToken.value;

  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = base64url(
    JSON.stringify({
      iss: sa.clientEmail,
      scope: FCM_SCOPE,
      aud: OAUTH_ENDPOINT,
      iat: now,
      exp: now + 3600,
    }),
  );
  const signingInput = `${header}.${claim}`;
  const signature = crypto.createSign("RSA-SHA256").update(signingInput).sign(sa.privateKey);
  const assertion = `${signingInput}.${base64url(signature)}`;

  const res = await fetch(OAUTH_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`FCM OAuth failed (${res.status}): ${detail.slice(0, 200)}`);
  }
  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { value: data.access_token, expiresAt: now + data.expires_in };
  return data.access_token;
}

type SendResult = { ok: true } | { ok: false; prune: boolean; detail: string };

async function sendOne(
  projectId: string,
  accessToken: string,
  token: string,
  message: NotificationMessage,
): Promise<SendResult> {
  const res = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
    method: "POST",
    headers: { authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
    body: JSON.stringify({
      message: {
        token,
        notification: { title: message.title, body: message.body },
        webpush: { fcmOptions: { link: appUrl("/notifications") } },
      },
    }),
  });
  if (res.ok) return { ok: true };
  const detail = await res.text().catch(() => "");
  // A 404, or an UNREGISTERED/invalid-token error, means the token is dead.
  const prune = res.status === 404 || /UNREGISTERED|invalid[- ]?registration/i.test(detail);
  return { ok: false, prune, detail: detail.slice(0, 200) };
}

export const webPushChannel: NotificationChannel = {
  name: "web-push",
  async deliver(schoolId, messages) {
    if (messages.length === 0) return;

    const sa = getServiceAccount();
    if (!sa) {
      console.warn(
        "[notifications] web-push channel skipped: set FIREBASE_SERVICE_ACCOUNT_KEY to enable",
      );
      return;
    }

    const recipientIds = [...new Set(messages.map((m) => m.recipientId))];
    const subs = await withTenant(schoolId, (tx) =>
      tx.pushSubscription.findMany({
        where: { recipientId: { in: recipientIds } },
        select: { token: true, recipientId: true },
      }),
    );
    if (subs.length === 0) return;

    const tokensByRecipient = new Map<string, string[]>();
    for (const sub of subs) {
      const list = tokensByRecipient.get(sub.recipientId) ?? [];
      list.push(sub.token);
      tokensByRecipient.set(sub.recipientId, list);
    }

    const accessToken = await getAccessToken(sa);
    const deadTokens: string[] = [];
    const failures: unknown[] = [];

    for (const message of messages) {
      for (const token of tokensByRecipient.get(message.recipientId) ?? []) {
        try {
          const result = await sendOne(sa.projectId, accessToken, token, message);
          if (!result.ok) {
            if (result.prune) deadTokens.push(token);
            else failures.push(new Error(`FCM send failed: ${result.detail}`));
          }
        } catch (error) {
          failures.push(error);
        }
      }
    }

    if (deadTokens.length > 0) {
      await withTenant(schoolId, (tx) =>
        tx.pushSubscription.deleteMany({ where: { token: { in: deadTokens } } }),
      );
    }
    if (failures.length > 0) {
      throw new AggregateError(failures, `web-push channel: ${failures.length} send(s) failed`);
    }
  },
};
