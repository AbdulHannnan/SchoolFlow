import "server-only";

import { createCipheriv } from "node:crypto";

/**
 * Easypaisa (Easypay) Hosted Checkout integration (Module 6.6).
 *
 * Flow: we build the request fields (signed with an AES-encrypted
 * `merchantHashedReq` keyed by the 16-char Hash Key) and the browser POSTs them
 * to Easypay; the customer pays; Easypay redirects back to our postback URL with
 * a `status` and our `orderRefNum`.
 *
 * Unlike JazzCash, the Easypay postback is not MAC-signed, so we don't trust it
 * on its own. Instead, initiating a payment records a PENDING "intent" keyed by
 * the `orderRefNum` we generate (see payments.createGatewayIntent); the return
 * handler only settles an intent we actually issued, and uses the amount from
 * our side — not the callback. (Production should additionally confirm via
 * Easypaisa's Transaction Inquiry API before settling.)
 *
 * Dev-safe: with the env unset `getEasypaisaConfig` returns null.
 */

export type EasypaisaConfig = {
  storeId: string;
  hashKey: string;
  postUrl: string;
  postBackUrl: string;
};

const EASYPAY_POST_URL = "https://easypay.easypaisa.com.pk/easypay/Index.jsf";
const PAYMENT_METHOD = "MA_PAYMENT_METHOD";

export function getEasypaisaConfig(): EasypaisaConfig | null {
  const storeId = process.env.EASYPAISA_STORE_ID;
  const hashKey = process.env.EASYPAISA_HASH_KEY;
  if (!storeId || !hashKey) return null;

  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return {
    storeId,
    hashKey,
    postUrl: process.env.EASYPAISA_POST_URL ?? EASYPAY_POST_URL,
    postBackUrl: process.env.EASYPAISA_POSTBACK_URL ?? `${base}/fees/pay/easypaisa/return`,
  };
}

/**
 * AES-128-ECB encrypt (base64) of the canonical `key=value&…` param string in
 * ascending key order, keyed by the 16-char Hash Key — Easypay's
 * `merchantHashedReq`.
 */
export function encryptRequest(params: Record<string, string>, hashKey: string): string {
  const message = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&");
  const cipher = createCipheriv("aes-128-ecb", Buffer.from(hashKey, "utf8"), null);
  return cipher.update(message, "utf8", "base64") + cipher.final("base64");
}

/** A short alphanumeric order reference: "EP" + base36 time + 4 random digits. */
export function newOrderRef(now: Date = new Date()): string {
  return `EP${now.getTime().toString(36)}${Math.floor(1000 + Math.random() * 9000)}`.toUpperCase();
}

export function buildEasypaisaRequest(
  config: EasypaisaConfig,
  input: { amount: string; orderRefNum: string },
): { postUrl: string; fields: Record<string, string> } {
  const hashedParams: Record<string, string> = {
    amount: input.amount,
    orderRefNum: input.orderRefNum,
    paymentMethod: PAYMENT_METHOD,
    postBackURL: config.postBackUrl,
    storeId: config.storeId,
  };
  const merchantHashedReq = encryptRequest(hashedParams, config.hashKey);

  const fields: Record<string, string> = {
    storeId: config.storeId,
    amount: input.amount,
    postBackURL: config.postBackUrl,
    orderRefNum: input.orderRefNum,
    merchantHashedReq,
    autoRedirect: "0",
    paymentMethod: PAYMENT_METHOD,
  };
  return { postUrl: config.postUrl, fields };
}

/** Read the order ref and success flag from an Easypay postback. */
export function parseEasypaisaReturn(fields: Record<string, string>): {
  orderRefNum: string;
  success: boolean;
  status: string;
} {
  const orderRefNum = fields.orderRefNumber ?? fields.orderRefNum ?? "";
  const status = fields.status ?? "";
  return { orderRefNum, status, success: status === "0000" };
}
