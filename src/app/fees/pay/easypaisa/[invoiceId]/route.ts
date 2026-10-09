import { requireSchool } from "@/server/auth/dal";
import { withTenant } from "@/server/db/tenant";
import {
  buildEasypaisaRequest,
  getEasypaisaConfig,
  newOrderRef,
} from "@/server/fees/gateways/easypaisa";
import {
  autoSubmitFormResponse,
  redirectWith,
  unconfiguredResponse,
} from "@/server/fees/gateways/http";
import { createGatewayIntent } from "@/server/fees/payments";

/**
 * Initiate an Easypaisa payment for an invoice (Module 6.6). Authorizes the
 * caller (linked parent, or head), records a PENDING intent keyed by the order
 * ref, then returns a self-submitting form that POSTs to Easypay. Dev-safe when
 * the gateway isn't configured.
 */
export async function GET(request: Request, ctx: { params: Promise<{ invoiceId: string }> }) {
  const { invoiceId } = await ctx.params;
  const { user, schoolId } = await requireSchool();
  const base = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;

  const invoice = await withTenant(schoolId, async (tx) => {
    const inv = await tx.invoice.findUnique({
      where: { id: invoiceId },
      select: { id: true, studentId: true, total: true, paidAmount: true, status: true },
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

  const config = getEasypaisaConfig();
  if (!config) return unconfiguredResponse(ledger, "Easypaisa");

  const amount = balance.toFixed(2);
  const orderRefNum = newOrderRef();
  await createGatewayIntent({
    schoolId,
    invoiceId: invoice.id,
    method: "EASYPAISA",
    reference: orderRefNum,
    amount,
  });

  const { postUrl, fields } = buildEasypaisaRequest(config, { amount, orderRefNum });
  return autoSubmitFormResponse(postUrl, fields, "Easypaisa");
}
