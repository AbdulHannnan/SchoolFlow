import "server-only";

import type { PaymentMethod, Prisma } from "@prisma/client";

import { requireSchool } from "@/server/auth/dal";
import { prisma } from "@/server/db";
import { withTenant } from "@/server/db/tenant";

/**
 * Payments & bank-transfer verification (Module 6.3). A HEAD records manual
 * payments (cash/cheque/verified transfer) which apply immediately; a parent
 * can submit a bank-transfer claim that stays PENDING until a HEAD verifies or
 * rejects it. Only VERIFIED payments count toward an invoice's balance, so
 * every apply recomputes the invoice from its verified payments. Tenant-scoped.
 */

/**
 * Recompute an invoice's `paidAmount` and `status` from the sum of its VERIFIED
 * payments. A CANCELLED invoice keeps that status. Runs inside the caller's tx.
 */
async function recomputeInvoice(tx: Prisma.TransactionClient, invoiceId: string): Promise<void> {
  const invoice = await tx.invoice.findUnique({
    where: { id: invoiceId },
    select: { total: true, status: true },
  });
  if (!invoice) return;

  const verified = await tx.payment.findMany({
    where: { invoiceId, status: "VERIFIED" },
    select: { amount: true },
  });
  const paid = verified.reduce((sum, p) => sum + Number(p.amount.toString()), 0);
  const total = Number(invoice.total.toString());

  const status =
    invoice.status === "CANCELLED"
      ? "CANCELLED"
      : paid <= 0
        ? "UNPAID"
        : paid >= total
          ? "PAID"
          : "PARTIAL";

  await tx.invoice.update({
    where: { id: invoiceId },
    data: { paidAmount: paid.toFixed(2), status },
  });
}

/** Record a manual payment (HEAD). Applied immediately (VERIFIED). */
export async function recordPayment(input: {
  invoiceId: string;
  amount: string;
  method: PaymentMethod;
  reference: string | null;
  note: string | null;
}): Promise<void> {
  const { user, schoolId } = await requireSchool();
  await withTenant(schoolId, async (tx) => {
    const invoice = await tx.invoice.findUnique({
      where: { id: input.invoiceId },
      select: { id: true },
    });
    if (!invoice) throw new Error("Invoice not found");

    await tx.payment.create({
      data: {
        schoolId,
        invoiceId: input.invoiceId,
        amount: input.amount,
        method: input.method,
        reference: input.reference,
        note: input.note,
        status: "VERIFIED",
        recordedById: user.id,
        verifiedAt: new Date(),
      },
    });
    await recomputeInvoice(tx, input.invoiceId);
  });
}

/**
 * Submit a bank-transfer claim against one's own child's invoice (PARENT).
 * Starts PENDING and does not affect the balance until a HEAD verifies it.
 */
export async function submitBankTransfer(input: {
  invoiceId: string;
  amount: string;
  reference: string;
  note: string | null;
}): Promise<void> {
  const { user, schoolId } = await requireSchool();
  await withTenant(schoolId, async (tx) => {
    const invoice = await tx.invoice.findUnique({
      where: { id: input.invoiceId },
      select: { studentId: true },
    });
    if (!invoice) throw new Error("Invoice not found");
    const link = await tx.parentStudent.findFirst({
      where: { parentId: user.id, studentId: invoice.studentId },
      select: { id: true },
    });
    if (!link) throw new Error("This invoice is not for your child");

    await tx.payment.create({
      data: {
        schoolId,
        invoiceId: input.invoiceId,
        amount: input.amount,
        method: "BANK_TRANSFER",
        reference: input.reference,
        note: input.note,
        status: "PENDING",
        recordedById: user.id,
      },
    });
  });
}

/**
 * Apply a payment that a payment gateway has confirmed (Module 6.5+). Runs in a
 * callback with no session, so it resolves the tenant from the invoice via the
 * owner client (which bypasses RLS, like other system operations) and then
 * applies within that tenant. Idempotent on `reference` (the gateway txn id),
 * so a repeated callback never double-credits. Returns the student the invoice
 * belongs to (for a redirect), or null if the invoice no longer exists.
 */
export async function applyGatewayPayment(input: {
  invoiceId: string;
  amount: string;
  method: PaymentMethod;
  reference: string;
}): Promise<{ studentId: string } | null> {
  const invoice = await prisma.invoice.findUnique({
    where: { id: input.invoiceId },
    select: { schoolId: true, studentId: true },
  });
  if (!invoice) return null;
  const { schoolId, studentId } = invoice;

  await withTenant(schoolId, async (tx) => {
    const existing = await tx.payment.findFirst({
      where: { invoiceId: input.invoiceId, reference: input.reference, status: "VERIFIED" },
      select: { id: true },
    });
    if (existing) return;
    await tx.payment.create({
      data: {
        schoolId,
        invoiceId: input.invoiceId,
        amount: input.amount,
        method: input.method,
        reference: input.reference,
        status: "VERIFIED",
        verifiedAt: new Date(),
      },
    });
    await recomputeInvoice(tx, input.invoiceId);
  });

  return { studentId };
}

/**
 * Record a PENDING gateway "intent" when a payment is initiated (Module 6.6).
 * Keyed by the gateway `reference` (our order ref) so the return handler can
 * settle only an intent we actually issued, and with the amount captured from
 * our side. `schoolId` comes from the caller's verified session (the route
 * already authorized the invoice), so this writes within that tenant.
 */
export async function createGatewayIntent(input: {
  schoolId: string;
  invoiceId: string;
  method: PaymentMethod;
  reference: string;
  amount: string;
}): Promise<void> {
  await withTenant(input.schoolId, async (tx) => {
    const invoice = await tx.invoice.findUnique({
      where: { id: input.invoiceId },
      select: { id: true },
    });
    if (!invoice) throw new Error("Invoice not found");
    await tx.payment.create({
      data: {
        schoolId: input.schoolId,
        invoiceId: input.invoiceId,
        amount: input.amount,
        method: input.method,
        reference: input.reference,
        status: "PENDING",
      },
    });
  });
}

/**
 * Settle a gateway intent from its return callback (Module 6.6). No session:
 * resolves the intent across tenants by `reference` via the owner client, then
 * within its tenant marks it VERIFIED (and recomputes the invoice) or REJECTED.
 * Idempotent — an already-settled intent is left as-is. Returns the student for
 * a redirect, or null if no such intent exists (e.g. a forged callback).
 */
export async function settleGatewayIntent(input: {
  reference: string;
  success: boolean;
}): Promise<{ studentId: string } | null> {
  const payment = await prisma.payment.findFirst({
    where: { reference: input.reference },
    select: {
      id: true,
      schoolId: true,
      status: true,
      invoiceId: true,
      invoice: { select: { studentId: true } },
    },
  });
  if (!payment) return null;
  const studentId = payment.invoice.studentId;
  if (payment.status !== "PENDING") return { studentId };

  await withTenant(payment.schoolId, async (tx) => {
    if (input.success) {
      await tx.payment.update({
        where: { id: payment.id },
        data: { status: "VERIFIED", verifiedAt: new Date() },
      });
      await recomputeInvoice(tx, payment.invoiceId);
    } else {
      await tx.payment.update({ where: { id: payment.id }, data: { status: "REJECTED" } });
    }
  });

  return { studentId };
}

/** Verify a pending payment and apply it to its invoice (HEAD). */
export async function verifyPayment(id: string): Promise<void> {
  const { schoolId } = await requireSchool();
  await withTenant(schoolId, async (tx) => {
    const payment = await tx.payment.findUnique({
      where: { id },
      select: { invoiceId: true, status: true },
    });
    if (!payment || payment.status !== "PENDING") return;
    await tx.payment.update({
      where: { id },
      data: { status: "VERIFIED", verifiedAt: new Date() },
    });
    await recomputeInvoice(tx, payment.invoiceId);
  });
}

/** Reject a pending payment (HEAD). Never counted, so no recompute needed. */
export async function rejectPayment(id: string): Promise<void> {
  const { schoolId } = await requireSchool();
  await withTenant(schoolId, async (tx) => {
    const payment = await tx.payment.findUnique({
      where: { id },
      select: { status: true },
    });
    if (!payment || payment.status !== "PENDING") return;
    await tx.payment.update({ where: { id }, data: { status: "REJECTED" } });
  });
}

export type PendingPaymentRow = {
  id: string;
  amount: string;
  reference: string | null;
  note: string | null;
  createdAt: Date;
  invoiceTitle: string;
  studentId: string;
  studentName: string;
};

/**
 * Pending bank-transfer claims awaiting manual verification (HEAD), oldest
 * first. Scoped to BANK_TRANSFER so gateway intents (PENDING until their return
 * settles them automatically) never show up as needing manual action.
 */
export async function listPendingPayments(): Promise<PendingPaymentRow[]> {
  const { schoolId } = await requireSchool();
  const rows = await withTenant(schoolId, (tx) =>
    tx.payment.findMany({
      where: { status: "PENDING", method: "BANK_TRANSFER" },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        amount: true,
        reference: true,
        note: true,
        createdAt: true,
        invoice: { select: { title: true, studentId: true, student: { select: { name: true } } } },
      },
    }),
  );
  return rows.map((r) => ({
    id: r.id,
    amount: r.amount.toString(),
    reference: r.reference,
    note: r.note,
    createdAt: r.createdAt,
    invoiceTitle: r.invoice.title,
    studentId: r.invoice.studentId,
    studentName: r.invoice.student.name,
  }));
}
