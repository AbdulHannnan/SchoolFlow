import "server-only";

import type { InvoiceStatus, Prisma } from "@prisma/client";
import type { Session } from "next-auth";

import { requireSchool } from "@/server/auth/dal";
import { withTenant } from "@/server/db/tenant";
import { monthLabel } from "@/lib/attendance";

/**
 * Invoices & per-student ledger (Module 6.2). Invoices are generated from the
 * fee structure (Module 6.1): one line item per applicable monthly fee, with
 * the total summed. Generation is idempotent per student per billing month via
 * the invoices' `(studentId, period)` unique key. Payments arrive in Module
 * 6.3; until then `paidAmount` is 0 and every invoice is UNPAID. Tenant-scoped;
 * reads/writes run inside the caller's RLS context.
 */

/** Sum rupee amounts (stored as Decimal) to a 2-dp string. */
function sumAmounts(amounts: { toString(): string }[]): string {
  let sum = 0;
  for (const a of amounts) sum += Number(a.toString());
  return sum.toFixed(2);
}

export type GenerateResult = {
  created: number;
  skipped: number;
  feeCount: number;
};

/**
 * Generate monthly invoices for a class (optionally one section) for a billing
 * month ("YYYY-MM"). Each active student without an invoice for that month gets
 * one, built from the MONTHLY fees that apply to their class (class-specific or
 * all-classes). Students already invoiced for the month are skipped.
 */
export async function generateInvoices(input: {
  classId: string;
  sectionId: string | null;
  period: string;
  dueDate: Date | null;
}): Promise<GenerateResult> {
  const { schoolId } = await requireSchool();
  const title = monthLabel(input.period);

  return withTenant(schoolId, async (tx) => {
    const cls = await tx.class.findUnique({
      where: { id: input.classId },
      select: { id: true },
    });
    if (!cls) throw new Error("Class not found");

    // Monthly fees that apply to this class: class-specific or all-classes.
    const fees = await tx.feeStructure.findMany({
      where: {
        isActive: true,
        frequency: "MONTHLY",
        OR: [{ classId: input.classId }, { classId: null }],
      },
      select: { id: true, amount: true, label: true, category: { select: { name: true } } },
    });
    if (fees.length === 0) return { created: 0, skipped: 0, feeCount: 0 };

    const students = await tx.student.findMany({
      where: {
        classId: input.classId,
        ...(input.sectionId ? { sectionId: input.sectionId } : {}),
        isActive: true,
      },
      select: { id: true },
    });
    if (students.length === 0) return { created: 0, skipped: 0, feeCount: fees.length };

    const already = new Set(
      (
        await tx.invoice.findMany({
          where: { studentId: { in: students.map((s) => s.id) }, period: input.period },
          select: { studentId: true },
        })
      ).map((i) => i.studentId),
    );

    const total = sumAmounts(fees.map((f) => f.amount));
    let created = 0;
    for (const student of students) {
      if (already.has(student.id)) continue;
      const invoice = await tx.invoice.create({
        data: {
          schoolId,
          studentId: student.id,
          classId: input.classId,
          period: input.period,
          title,
          dueDate: input.dueDate,
          total,
        },
        select: { id: true },
      });
      await tx.invoiceLineItem.createMany({
        data: fees.map((f) => ({
          schoolId,
          invoiceId: invoice.id,
          feeStructureId: f.id,
          description: f.label ?? f.category.name,
          amount: f.amount,
        })),
      });
      created += 1;
    }

    return { created, skipped: students.length - created, feeCount: fees.length };
  });
}

export type InvoiceRow = {
  id: string;
  studentId: string;
  studentName: string;
  rollNumber: string | null;
  className: string | null;
  period: string;
  title: string;
  dueDate: Date | null;
  status: InvoiceStatus;
  total: string;
  paidAmount: string;
  balance: string;
};

function toRow(i: {
  id: string;
  studentId: string;
  period: string;
  title: string;
  dueDate: Date | null;
  status: InvoiceStatus;
  total: Prisma.Decimal;
  paidAmount: Prisma.Decimal;
  student: { name: string; rollNumber: string | null };
  class: { name: string } | null;
}): InvoiceRow {
  const total = i.total.toString();
  const paidAmount = i.paidAmount.toString();
  return {
    id: i.id,
    studentId: i.studentId,
    studentName: i.student.name,
    rollNumber: i.student.rollNumber,
    className: i.class?.name ?? null,
    period: i.period,
    title: i.title,
    dueDate: i.dueDate,
    status: i.status,
    total,
    paidAmount,
    balance: (Number(total) - Number(paidAmount)).toFixed(2),
  };
}

/** Invoices for the whole school (HEAD), newest period first; optional filters. */
export async function listInvoices(input?: { classId?: string | null; period?: string | null }) {
  const { schoolId } = await requireSchool();
  return withTenant(schoolId, async (tx) => {
    const rows = await tx.invoice.findMany({
      where: {
        ...(input?.classId ? { classId: input.classId } : {}),
        ...(input?.period ? { period: input.period } : {}),
      },
      orderBy: [{ period: "desc" }, { createdAt: "desc" }],
      take: 200,
      select: {
        id: true,
        studentId: true,
        period: true,
        title: true,
        dueDate: true,
        status: true,
        total: true,
        paidAmount: true,
        student: { select: { name: true, rollNumber: true } },
        class: { select: { name: true } },
      },
    });
    return rows.map(toRow);
  });
}

async function assertCanViewStudent(
  tx: Prisma.TransactionClient,
  user: Session["user"],
  studentId: string,
): Promise<void> {
  if (user.role === "HEAD") return;
  if (user.role === "PARENT") {
    const link = await tx.parentStudent.findFirst({
      where: { parentId: user.id, studentId },
      select: { id: true },
    });
    if (!link) throw new Error("This student is not linked to your account");
    return;
  }
  throw new Error("Not allowed to view this ledger");
}

export type LedgerLine = { id: string; description: string; amount: string };
export type LedgerInvoice = Omit<InvoiceRow, "studentName" | "rollNumber"> & {
  lineItems: LedgerLine[];
};

/**
 * One student's full ledger: every invoice with its line items and the running
 * totals (billed / paid / balance). HEAD sees any student; a PARENT only a
 * linked child.
 */
export async function getStudentLedger(studentId: string) {
  const { user, schoolId } = await requireSchool();
  return withTenant(schoolId, async (tx) => {
    const student = await tx.student.findUnique({
      where: { id: studentId },
      select: {
        id: true,
        name: true,
        rollNumber: true,
        class: { select: { name: true } },
        section: { select: { name: true } },
      },
    });
    if (!student) throw new Error("Student not found");
    await assertCanViewStudent(tx, user, studentId);

    const invoices = await tx.invoice.findMany({
      where: { studentId },
      orderBy: [{ period: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        studentId: true,
        period: true,
        title: true,
        dueDate: true,
        status: true,
        total: true,
        paidAmount: true,
        student: { select: { name: true, rollNumber: true } },
        class: { select: { name: true } },
        lineItems: {
          orderBy: { createdAt: "asc" },
          select: { id: true, description: true, amount: true },
        },
      },
    });

    const ledgerInvoices: LedgerInvoice[] = invoices.map((i) => {
      const row = toRow(i);
      return {
        id: row.id,
        studentId: row.studentId,
        className: row.className,
        period: row.period,
        title: row.title,
        dueDate: row.dueDate,
        status: row.status,
        total: row.total,
        paidAmount: row.paidAmount,
        balance: row.balance,
        lineItems: i.lineItems.map((l) => ({
          id: l.id,
          description: l.description,
          amount: l.amount.toString(),
        })),
      };
    });

    const billed = sumAmounts(invoices.map((i) => i.total));
    const paid = sumAmounts(invoices.map((i) => i.paidAmount));
    const balance = (Number(billed) - Number(paid)).toFixed(2);

    return { student, invoices: ledgerInvoices, summary: { billed, paid, balance } };
  });
}

export type ChildLedgerSummary = {
  student: { id: string; name: string; className: string | null; sectionName: string | null };
  invoiceCount: number;
  billed: string;
  paid: string;
  balance: string;
};

/** The signed-in parent's children, each with a ledger summary. */
export async function listChildrenLedgerSummaries(): Promise<ChildLedgerSummary[]> {
  const { user, schoolId } = await requireSchool();
  return withTenant(schoolId, async (tx) => {
    const links = await tx.parentStudent.findMany({
      where: { parentId: user.id },
      orderBy: { createdAt: "asc" },
      select: {
        student: {
          select: {
            id: true,
            name: true,
            class: { select: { name: true } },
            section: { select: { name: true } },
            invoices: { select: { total: true, paidAmount: true } },
          },
        },
      },
    });

    return links.map(({ student }) => {
      const billed = sumAmounts(student.invoices.map((i) => i.total));
      const paid = sumAmounts(student.invoices.map((i) => i.paidAmount));
      return {
        student: {
          id: student.id,
          name: student.name,
          className: student.class?.name ?? null,
          sectionName: student.section?.name ?? null,
        },
        invoiceCount: student.invoices.length,
        billed,
        paid,
        balance: (Number(billed) - Number(paid)).toFixed(2),
      };
    });
  });
}
