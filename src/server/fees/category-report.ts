import "server-only";

import type { InvoiceStatus } from "@prisma/client";

import { requireSchool } from "@/server/auth/dal";
import { withTenant } from "@/server/db/tenant";
import { monthLabel } from "@/lib/attendance";

/**
 * Fee reporting organised by category (Admission, Tuition, Fines, …) rather
 * than the raw per-student invoice list. A category box aggregates every
 * invoice line item in that category; clicking it drills into the per-student
 * charges. Both views share the same optional filters: billing month (`period`,
 * "YYYY-MM") and `classId`.
 *
 * Payments are recorded against a whole invoice, and one invoice can carry line
 * items from several categories, so a category's "collected" figure is each
 * invoice's paid amount allocated across its line items **proportionally by
 * amount** - the usual ledger approximation when a payment isn't earmarked to a
 * single charge. Billed is exact; collected/outstanding are this allocation.
 */

export type CategoryFilter = { period: string | null; classId: string | null };

/** The paid share of one line item, given its invoice's paid ratio. */
function allocate(lineAmount: number, invoiceTotal: number, invoicePaid: number): number {
  if (invoiceTotal <= 0) return 0;
  const ratio = invoicePaid / invoiceTotal;
  return lineAmount * (ratio > 1 ? 1 : ratio);
}

function buildInvoiceWhere(filter: CategoryFilter) {
  return {
    ...(filter.period ? { period: filter.period } : {}),
    ...(filter.classId ? { classId: filter.classId } : {}),
  };
}

export type CategorySummary = {
  id: string;
  name: string;
  billed: string;
  collected: string;
  outstanding: string;
  /** Distinct students charged in this category for the filter. */
  studentCount: number;
  /** Number of individual charges (line items). */
  chargeCount: number;
};

/**
 * One summary row per fee category (including categories with no charges yet),
 * aggregated over the invoices matching the filter. Drives the Fees landing
 * boxes.
 */
export async function listCategorySummaries(filter: CategoryFilter): Promise<CategorySummary[]> {
  const { schoolId } = await requireSchool();
  return withTenant(schoolId, async (tx) => {
    const categories = await tx.feeCategory.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    });

    const invoices = await tx.invoice.findMany({
      where: buildInvoiceWhere(filter),
      select: {
        studentId: true,
        total: true,
        paidAmount: true,
        lineItems: {
          select: {
            amount: true,
            feeStructure: { select: { categoryId: true } },
          },
        },
      },
    });

    type Agg = { billed: number; collected: number; students: Set<string>; charges: number };
    const byCategory = new Map<string, Agg>();
    for (const cat of categories) {
      byCategory.set(cat.id, { billed: 0, collected: 0, students: new Set(), charges: 0 });
    }

    for (const inv of invoices) {
      const total = Number(inv.total);
      const paid = Number(inv.paidAmount);
      for (const li of inv.lineItems) {
        const categoryId = li.feeStructure?.categoryId;
        if (!categoryId) continue; // ad-hoc line item with no structure/category
        const agg = byCategory.get(categoryId);
        if (!agg) continue; // category from another tenant shouldn't happen under RLS
        const amount = Number(li.amount);
        agg.billed += amount;
        agg.collected += allocate(amount, total, paid);
        agg.students.add(inv.studentId);
        agg.charges += 1;
      }
    }

    return categories.map((cat) => {
      const agg = byCategory.get(cat.id)!;
      return {
        id: cat.id,
        name: cat.name,
        billed: agg.billed.toFixed(2),
        collected: agg.collected.toFixed(2),
        outstanding: (agg.billed - agg.collected).toFixed(2),
        studentCount: agg.students.size,
        chargeCount: agg.charges,
      };
    });
  });
}

export type CategoryChargeRow = {
  invoiceId: string;
  studentId: string;
  studentName: string;
  rollNumber: string | null;
  className: string | null;
  period: string;
  periodLabel: string;
  dueDate: Date | null;
  charged: string;
  paid: string;
  outstanding: string;
  /** Per-category status derived from the allocated paid share. */
  status: InvoiceStatus;
};

export type CategoryBreakdown = {
  category: { id: string; name: string };
  rows: CategoryChargeRow[];
  summary: { billed: string; collected: string; outstanding: string; studentCount: number };
};

/** Derive a per-category status from its billed/paid share of one invoice. */
function rowStatus(
  charged: number,
  paid: number,
  invoiceStatus: InvoiceStatus,
): InvoiceStatus {
  if (invoiceStatus === "CANCELLED") return "CANCELLED";
  if (paid <= 0) return "UNPAID";
  if (paid + 0.005 >= charged) return "PAID";
  return "PARTIAL";
}

/**
 * The per-student charges for one category under the filter, with a summary.
 * Throws if the category isn't in the caller's school.
 */
export async function getCategoryBreakdown(
  categoryId: string,
  filter: CategoryFilter,
): Promise<CategoryBreakdown> {
  const { schoolId } = await requireSchool();
  return withTenant(schoolId, async (tx) => {
    const category = await tx.feeCategory.findUnique({
      where: { id: categoryId },
      select: { id: true, name: true },
    });
    if (!category) throw new Error("Category not found");

    const invoices = await tx.invoice.findMany({
      where: {
        ...buildInvoiceWhere(filter),
        lineItems: { some: { feeStructure: { is: { categoryId } } } },
      },
      orderBy: [{ period: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        studentId: true,
        period: true,
        dueDate: true,
        status: true,
        total: true,
        paidAmount: true,
        student: { select: { name: true, rollNumber: true } },
        class: { select: { name: true } },
        lineItems: {
          where: { feeStructure: { is: { categoryId } } },
          select: { amount: true },
        },
      },
    });

    let billed = 0;
    let collected = 0;
    const students = new Set<string>();

    const rows: CategoryChargeRow[] = invoices.map((inv) => {
      const total = Number(inv.total);
      const paid = Number(inv.paidAmount);
      const charged = inv.lineItems.reduce((sum, li) => sum + Number(li.amount), 0);
      const allocated = allocate(charged, total, paid);
      billed += charged;
      collected += allocated;
      students.add(inv.studentId);
      return {
        invoiceId: inv.id,
        studentId: inv.studentId,
        studentName: inv.student.name,
        rollNumber: inv.student.rollNumber,
        className: inv.class?.name ?? null,
        period: inv.period,
        periodLabel: monthLabel(inv.period),
        dueDate: inv.dueDate,
        charged: charged.toFixed(2),
        paid: allocated.toFixed(2),
        outstanding: (charged - allocated).toFixed(2),
        status: rowStatus(charged, allocated, inv.status),
      };
    });

    // Group by student name for a stable, readable order within each period.
    rows.sort((a, b) =>
      a.period === b.period
        ? a.studentName.localeCompare(b.studentName)
        : a.period < b.period
          ? 1
          : -1,
    );

    return {
      category,
      rows,
      summary: {
        billed: billed.toFixed(2),
        collected: collected.toFixed(2),
        outstanding: (billed - collected).toFixed(2),
        studentCount: students.size,
      },
    };
  });
}
