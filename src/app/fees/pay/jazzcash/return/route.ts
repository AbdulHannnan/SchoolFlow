import { getJazzCashConfig, verifyJazzCashReturn } from "@/server/fees/gateways/jazzcash";
import { applyGatewayPayment } from "@/server/fees/payments";

/**
 * JazzCash return handler (Module 6.5). JazzCash redirects the customer's
 * browser here (POST) with the signed response. We verify the secure hash — a
 * match proves authenticity — and, on a success code, record a VERIFIED
 * JazzCash payment against the invoice (idempotent on the txn ref). A failed or
 * tampered response records nothing. Either way we redirect to the ledger with
 * a status for a banner.
 */
async function handle(request: Request): Promise<Response> {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
  const config = getJazzCashConfig();
  if (!config) return redirectWith(base, "/fees", "unconfigured");

  const fields = await readFields(request);
  const result = verifyJazzCashReturn(fields, config);

  if (result.ok && result.invoiceId) {
    const amount = (result.amountPaisa / 100).toFixed(2);
    const applied = await applyGatewayPayment({
      invoiceId: result.invoiceId,
      amount,
      method: "JAZZCASH",
      reference: result.txnRef,
    });
    const path = applied ? `/fees/students/${applied.studentId}` : "/fees";
    return redirectWith(base, path, "success");
  }

  // Tampered hash is treated distinctly from a genuine decline.
  return redirectWith(base, "/fees", result.hashOk ? "failed" : "invalid");
}

export const GET = handle;
export const POST = handle;

async function readFields(request: Request): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  if (request.method === "POST") {
    const form = await request.formData();
    for (const [key, value] of form.entries()) out[key] = String(value);
  } else {
    for (const [key, value] of new URL(request.url).searchParams.entries()) out[key] = value;
  }
  return out;
}

function redirectWith(base: string, path: string, status: string): Response {
  return Response.redirect(new URL(`${path}?pay=${status}`, base).toString(), 303);
}
