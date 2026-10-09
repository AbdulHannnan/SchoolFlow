import { requireSchool } from "@/server/auth/dal";
import { withTenant } from "@/server/db/tenant";
import {
  buildJazzCashRequest,
  getJazzCashConfig,
  newTxnRef,
} from "@/server/fees/gateways/jazzcash";

/**
 * Initiate a JazzCash payment for an invoice (Module 6.5). Authorizes the
 * caller (the linked parent, or a head), then returns a self-submitting form
 * that POSTs the signed `pp_*` fields to JazzCash. Dev-safe: if the gateway
 * isn't configured, shows a short page instead.
 */
export async function GET(request: Request, ctx: { params: Promise<{ invoiceId: string }> }) {
  const { invoiceId } = await ctx.params;
  const { user, schoolId } = await requireSchool();
  const base = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;

  const invoice = await withTenant(schoolId, async (tx) => {
    const inv = await tx.invoice.findUnique({
      where: { id: invoiceId },
      select: {
        id: true,
        studentId: true,
        title: true,
        total: true,
        paidAmount: true,
        status: true,
      },
    });
    if (!inv) return null;
    if (user.role === "PARENT") {
      const link = await tx.parentStudent.findFirst({
        where: { parentId: user.id, studentId: inv.studentId },
        select: { id: true },
      });
      if (!link) return null;
    } else if (user.role !== "HEAD") {
      return null;
    }
    return inv;
  });

  if (!invoice) return redirectWith(base, "/fees", "notfound");

  const ledger = `/fees/students/${invoice.studentId}`;
  const balance = Number(invoice.total.toString()) - Number(invoice.paidAmount.toString());
  if (invoice.status === "CANCELLED" || balance <= 0) return redirectWith(base, ledger, "nothing");

  const config = getJazzCashConfig();
  if (!config) return html(unconfiguredPage(ledger));

  const { postUrl, fields } = buildJazzCashRequest(config, {
    invoiceId: invoice.id,
    amountPaisa: Math.round(balance * 100),
    txnRef: newTxnRef(),
    description: `Fee payment - ${invoice.title}`,
  });

  return html(autoSubmitForm(postUrl, fields));
}

function html(body: string): Response {
  return new Response(body, { headers: { "content-type": "text/html; charset=utf-8" } });
}

function redirectWith(base: string, path: string, status: string): Response {
  return Response.redirect(new URL(`${path}?pay=${status}`, base).toString(), 303);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function autoSubmitForm(postUrl: string, fields: Record<string, string>): string {
  const inputs = Object.entries(fields)
    .map(([k, v]) => `<input type="hidden" name="${escapeHtml(k)}" value="${escapeHtml(v)}" />`)
    .join("\n");
  return `<!doctype html>
<html>
  <head><meta charset="utf-8" /><title>Redirecting to JazzCash…</title></head>
  <body style="font-family: system-ui; padding: 2rem;">
    <p>Redirecting you to JazzCash to complete payment…</p>
    <form id="jc" method="post" action="${escapeHtml(postUrl)}">
      ${inputs}
      <noscript><button type="submit">Continue to JazzCash</button></noscript>
    </form>
    <script>document.getElementById('jc').submit();</script>
  </body>
</html>`;
}

function unconfiguredPage(ledger: string): string {
  return `<!doctype html>
<html>
  <head><meta charset="utf-8" /><title>JazzCash not configured</title></head>
  <body style="font-family: system-ui; padding: 2rem;">
    <p>Online payment via JazzCash isn't set up for this school yet.</p>
    <p><a href="${escapeHtml(ledger)}">Back to fees</a></p>
  </body>
</html>`;
}
