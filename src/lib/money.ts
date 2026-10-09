/**
 * Money presentation (Module 6). Amounts are stored as fixed-scale decimals and
 * carried around as strings; this formats them as PKR for display. Isomorphic
 * (no server-only imports), so both server and client components can use it.
 */
const PKR = new Intl.NumberFormat("en-PK", {
  style: "currency",
  currency: "PKR",
  maximumFractionDigits: 2,
});

/** Format a rupee amount (string | number) as e.g. "PKR 1,500.00". */
export function formatPKR(amount: string | number): string {
  const n = typeof amount === "string" ? Number(amount) : amount;
  return Number.isFinite(n) ? PKR.format(n) : String(amount);
}

export const FEE_FREQUENCY_LABELS: Record<string, string> = {
  MONTHLY: "Monthly",
  QUARTERLY: "Quarterly",
  ANNUAL: "Annual",
  ONE_TIME: "One-time",
};

export const INVOICE_STATUS_LABELS: Record<string, string> = {
  UNPAID: "Unpaid",
  PARTIAL: "Partial",
  PAID: "Paid",
  CANCELLED: "Cancelled",
};

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  CASH: "Cash",
  BANK_TRANSFER: "Bank transfer",
  CARD: "Card",
  OTHER: "Other",
};

export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  PENDING: "Pending",
  VERIFIED: "Verified",
  REJECTED: "Rejected",
};
