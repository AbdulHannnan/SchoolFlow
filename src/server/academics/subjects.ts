import "server-only";

import { requireSchool, withCurrentTenant } from "@/server/auth/dal";
import { withTenant } from "@/server/db/tenant";

/** Subjects data access (Module 2.2). Tenant-scoped; roles enforced in actions. */

export function listSubjects() {
  return withCurrentTenant((tx) => tx.subject.findMany({ orderBy: { name: "asc" } }));
}

export async function createSubject(input: { name: string; code: string | null }) {
  const { schoolId } = await requireSchool();
  return withTenant(schoolId, (tx) =>
    tx.subject.create({ data: { schoolId, name: input.name, code: input.code } }),
  );
}

export async function deleteSubject(id: string) {
  const { schoolId } = await requireSchool();
  return withTenant(schoolId, (tx) => tx.subject.delete({ where: { id } }));
}
