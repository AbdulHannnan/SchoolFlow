import "server-only";

import type { FeeFrequency } from "@prisma/client";

import { requireSchool, withCurrentTenant } from "@/server/auth/dal";
import { withTenant } from "@/server/db/tenant";

/**
 * Fee structure (Module 6.1): the catalogue of fees a school charges, grouped
 * into categories and optionally pinned to a class. Invoices (Module 6.2) are
 * generated from these templates. Tenant-scoped; all reads/writes run inside
 * the caller's RLS context. Role enforcement (HEAD) lives in the actions.
 */

export function listFeeCategories() {
  return withCurrentTenant((tx) =>
    tx.feeCategory.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  );
}

export async function createFeeCategory(input: { name: string }) {
  const { schoolId } = await requireSchool();
  return withTenant(schoolId, (tx) =>
    tx.feeCategory.create({ data: { schoolId, name: input.name } }),
  );
}

export async function deleteFeeCategory(id: string) {
  const { schoolId } = await requireSchool();
  // RLS hides other tenants' rows, so a foreign id deletes nothing.
  return withTenant(schoolId, (tx) => tx.feeCategory.delete({ where: { id } }));
}

export type FeeStructureRow = {
  id: string;
  label: string | null;
  /** Serialized as a string so Prisma's Decimal never crosses into a client component. */
  amount: string;
  frequency: FeeFrequency;
  isActive: boolean;
  category: { id: string; name: string };
  class: { id: string; name: string } | null;
};

export async function listFeeStructures(): Promise<FeeStructureRow[]> {
  const rows = await withCurrentTenant((tx) =>
    tx.feeStructure.findMany({
      orderBy: [{ category: { name: "asc" } }, { createdAt: "asc" }],
      select: {
        id: true,
        label: true,
        amount: true,
        frequency: true,
        isActive: true,
        category: { select: { id: true, name: true } },
        class: { select: { id: true, name: true } },
      },
    }),
  );
  return rows.map((r) => ({ ...r, amount: r.amount.toString() }));
}

export async function createFeeStructure(input: {
  categoryId: string;
  classId: string | null;
  label: string | null;
  amount: string;
  frequency: FeeFrequency;
}) {
  const { schoolId } = await requireSchool();
  return withTenant(schoolId, async (tx) => {
    // Re-check FK targets in-tenant (RLS doesn't guard FK targets): the category
    // and (if given) the class must belong to the caller's school.
    const category = await tx.feeCategory.findUnique({
      where: { id: input.categoryId },
      select: { id: true },
    });
    if (!category) throw new Error("Category not found");
    if (input.classId) {
      const cls = await tx.class.findUnique({
        where: { id: input.classId },
        select: { id: true },
      });
      if (!cls) throw new Error("Class not found");
    }
    return tx.feeStructure.create({
      data: {
        schoolId,
        categoryId: input.categoryId,
        classId: input.classId,
        label: input.label,
        amount: input.amount,
        frequency: input.frequency,
      },
    });
  });
}

export async function deleteFeeStructure(id: string) {
  const { schoolId } = await requireSchool();
  return withTenant(schoolId, (tx) => tx.feeStructure.delete({ where: { id } }));
}
