import "server-only";

import type { SupportStaffRole } from "@prisma/client";

import { requireSchool, withCurrentTenant } from "@/server/auth/dal";
import { withTenant } from "@/server/db/tenant";

/**
 * Non-teaching staff directory (support workers: driver, gardener, maid, clerk,
 * guard, ...). Tenant-scoped; the HEAD role is enforced in the Server Actions.
 *
 * `monthlySalary` is a Prisma `Decimal`; it is serialized to a string on read
 * so it never crosses into a client component (same rule as fee amounts).
 */

export type StaffMemberView = {
  id: string;
  name: string;
  role: SupportStaffRole;
  customRole: string | null;
  phone: string | null;
  cnic: string | null;
  address: string | null;
  joiningDate: Date | null;
  monthlySalary: string | null;
  isActive: boolean;
};

export async function listStaff(): Promise<StaffMemberView[]> {
  const rows = await withCurrentTenant((tx) =>
    tx.staffMember.findMany({
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        role: true,
        customRole: true,
        phone: true,
        cnic: true,
        address: true,
        joiningDate: true,
        monthlySalary: true,
        isActive: true,
      },
    }),
  );
  return rows.map((r) => ({
    ...r,
    monthlySalary: r.monthlySalary != null ? r.monthlySalary.toString() : null,
  }));
}

type StaffInput = {
  name: string;
  role: SupportStaffRole;
  customRole: string | null;
  phone: string | null;
  cnic: string | null;
  address: string | null;
  joiningDate: Date | null;
  monthlySalary: string | null;
};

export async function createStaff(input: StaffInput) {
  const { schoolId } = await requireSchool();
  return withTenant(schoolId, (tx) =>
    tx.staffMember.create({
      data: {
        schoolId,
        name: input.name,
        role: input.role,
        // `customRole` only makes sense for OTHER; clear it otherwise.
        customRole: input.role === "OTHER" ? input.customRole : null,
        phone: input.phone,
        cnic: input.cnic,
        address: input.address,
        joiningDate: input.joiningDate,
        monthlySalary: input.monthlySalary,
      },
    }),
  );
}

export async function updateStaff(input: StaffInput & { id: string; isActive: boolean }) {
  const { schoolId } = await requireSchool();
  return withTenant(schoolId, async (tx) => {
    // RLS hides other tenants' rows, so a foreign id resolves to nothing here.
    const existing = await tx.staffMember.findUnique({
      where: { id: input.id },
      select: { id: true },
    });
    if (!existing) throw new Error("Staff member not found");
    return tx.staffMember.update({
      where: { id: input.id },
      data: {
        name: input.name,
        role: input.role,
        customRole: input.role === "OTHER" ? input.customRole : null,
        phone: input.phone,
        cnic: input.cnic,
        address: input.address,
        joiningDate: input.joiningDate,
        monthlySalary: input.monthlySalary,
        isActive: input.isActive,
      },
    });
  });
}

export async function deleteStaff(id: string) {
  const { schoolId } = await requireSchool();
  return withTenant(schoolId, (tx) => tx.staffMember.deleteMany({ where: { id } }));
}
