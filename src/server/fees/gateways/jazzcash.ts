import "server-only";

import { createHmac } from "node:crypto";

/**
 * JazzCash Hosted Checkout integration (Module 6.5).
 *
 * Flow: we build a signed set of `pp_*` fields and the browser POSTs them to
 * JazzCash; the customer pays there; JazzCash redirects back to our return URL
 * with a signed response. Both directions are signed with the shared Integrity
 * Salt (HMAC-SHA256 over the sorted field values), so a valid hash on the
 * return proves the response is authentic and untampered.
 *
 * Dev-safe: with the JazzCash env unset `getJazzCashConfig` returns null and the
 * routes show "not configured" instead of failing. The invoice id is carried in
 * `ppmpf_1` (a merchant pass-through echoed back) for correlation on return,
 * since `pp_BillReference` has length limits.
 */

export type JazzCashConfig = {
  merchantId: string;
  password: string;
  salt: string;
  postUrl: string;
  returnUrl: string;
};

const SANDBOX_POST_URL =
  "https://sandbox.jazzcash.com.pk/CustomerPortal/transactionmanagement/merchantform/";

export function getJazzCashConfig(): JazzCashConfig | null {
  const merchantId = process.env.JAZZCASH_MERCHANT_ID;
  const password = process.env.JAZZCASH_PASSWORD;
  const salt = process.env.JAZZCASH_INTEGRITY_SALT;
  if (!merchantId || !password || !salt) return null;

  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return {
    merchantId,
    password,
    salt,
    postUrl: process.env.JAZZCASH_POST_URL ?? SANDBOX_POST_URL,
    returnUrl: process.env.JAZZCASH_RETURN_URL ?? `${base}/fees/pay/jazzcash/return`,
  };
}

/**
 * JazzCash secure hash: HMAC-SHA256 (keyed with the salt) over the salt
 * followed by every non-empty `pp_`/`ppmpf_` field value in ascending key
 * order, joined by "&". Returned uppercase hex. Used for both the request and
 * verifying the return.
 */
export function computeSecureHash(fields: Record<string, string>, salt: string): string {
  const keys = Object.keys(fields)
    .filter(
      (k) =>
        (k.startsWith("pp_") || k.startsWith("ppmpf_")) &&
        k !== "pp_SecureHash" &&
        fields[k] !== "" &&
        fields[k] != null,
    )
    .sort();
  const message = [salt, ...keys.map((k) => fields[k])].join("&");
  return createHmac("sha256", salt).update(message).digest("hex").toUpperCase();
}

/** yyyyMMddHHmmss in local time, as JazzCash expects. */
function formatTimestamp(date: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return (
    `${date.getFullYear()}${p(date.getMonth() + 1)}${p(date.getDate())}` +
    `${p(date.getHours())}${p(date.getMinutes())}${p(date.getSeconds())}`
  );
}

/** A unique transaction reference: "T" + timestamp + 4 random digits. */
export function newTxnRef(now: Date = new Date()): string {
  return `T${formatTimestamp(now)}${Math.floor(1000 + Math.random() * 9000)}`;
}

/**
 * Build the signed `pp_*` fields (and POST URL) for an invoice payment.
 * `amountPaisa` is the integer rupees×100 JazzCash expects.
 */
export function buildJazzCashRequest(
  config: JazzCashConfig,
  input: { invoiceId: string; amountPaisa: number; txnRef: string; description: string },
): { postUrl: string; fields: Record<string, string> } {
  const now = new Date();
  const expiry = new Date(now.getTime() + 60 * 60 * 1000);

  const fields: Record<string, string> = {
    pp_Version: "1.1",
    pp_TxnType: "MWALLET",
    pp_Language: "EN",
    pp_MerchantID: config.merchantId,
    pp_Password: config.password,
    pp_TxnRefNo: input.txnRef,
    pp_Amount: String(input.amountPaisa),
    pp_TxnCurrency: "PKR",
    pp_TxnDateTime: formatTimestamp(now),
    pp_BillReference: input.txnRef,
    pp_Description: input.description,
    pp_TxnExpiryDateTime: formatTimestamp(expiry),
    pp_ReturnURL: config.returnUrl,
    // Pass-through: echoed back on the return so we can map it to the invoice.
    ppmpf_1: input.invoiceId,
  };
  fields.pp_SecureHash = computeSecureHash(fields, config.salt);
  return { postUrl: config.postUrl, fields };
}

export type JazzCashReturn = {
  /** Hash verified AND the response code is success. */
  ok: boolean;
  /** Whether the secure hash matched (authenticity), regardless of outcome. */
  hashOk: boolean;
  responseCode: string;
  /** The invoice id carried in `ppmpf_1`, or null. */
  invoiceId: string | null;
  txnRef: string;
  amountPaisa: number;
};

/** Verify a JazzCash return payload: recompute the hash and read the outcome. */
export function verifyJazzCashReturn(
  fields: Record<string, string>,
  config: JazzCashConfig,
): JazzCashReturn {
  const provided = (fields.pp_SecureHash ?? "").toUpperCase();
  const expected = computeSecureHash(fields, config.salt);
  const hashOk = provided.length > 0 && provided === expected;
  const responseCode = fields.pp_ResponseCode ?? "";
  return {
    ok: hashOk && responseCode === "000",
    hashOk,
    responseCode,
    invoiceId: fields.ppmpf_1 || null,
    txnRef: fields.pp_TxnRefNo ?? "",
    amountPaisa: Number(fields.pp_Amount ?? "0"),
  };
}
