import { getEasypaisaConfig, parseEasypaisaReturn } from "@/server/fees/gateways/easypaisa";
import { redirectWith } from "@/server/fees/gateways/http";
import { settleGatewayIntent } from "@/server/fees/payments";

/**
 * Easypaisa postback handler (Module 6.6). Easypay redirects the customer here
 * with a `status` and our `orderRefNum`. We settle the matching PENDING intent
 * (which we recorded at initiation with the amount from our side) — success
 * marks it VERIFIED and recomputes the invoice; anything else rejects it. A
 * callback whose order ref matches no intent of ours settles nothing.
 */
async function handle(request: Request): Promise<Response> {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
  if (!getEasypaisaConfig()) return redirectWith(base, "/fees", "unconfigured");

  const fields = await readFields(request);
  const { orderRefNum, success } = parseEasypaisaReturn(fields);
  if (!orderRefNum) return redirectWith(base, "/fees", "failed");

  const settled = await settleGatewayIntent({ reference: orderRefNum, success });
  if (!settled) return redirectWith(base, "/fees", "failed");

  return redirectWith(base, `/fees/students/${settled.studentId}`, success ? "success" : "failed");
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
