import "server-only";

import type { PaymentMethod, Prisma } from "@prisma/client";

import { requireSchool } from "@/server/auth/dal";
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

/** Pending bank-transfer claims awaiting verification (HEAD), oldest first. */
export async function listPendingPayments(): Promise<PendingPaymentRow[]> {
  const { schoolId } = await requireSchool();
  const rows = await withTenant(schoolId, (tx) =>
    tx.payment.findMany({
      where: { status: "PENDING" },
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
