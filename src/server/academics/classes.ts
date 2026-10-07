import "server-only";

import { requireSchool, withCurrentTenant } from "@/server/auth/dal";
import { withTenant } from "@/server/db/tenant";

/**
 * Classes & Sections data access (Module 2.1). All functions run inside the
 * caller's tenant RLS context, so they can only ever touch the caller's own
 * school. Role enforcement (HEAD) lives in the Server Actions.
 */

export function listClassesWithSections() {
  return withCurrentTenant((tx) =>
    tx.class.findMany({
      orderBy: [{ level: "asc" }, { name: "asc" }],
      include: { sections: { orderBy: { name: "asc" } } },
    }),
  );
}

export async function createClass(input: { name: string; level: number | null }) {
  const { schoolId } = await requireSchool();
  return withTenant(schoolId, (tx) =>
    tx.class.create({ data: { schoolId, name: input.name, level: input.level } }),
  );
}

export async function createSection(input: { classId: string; name: string }) {
  const { schoolId } = await requireSchool();
  return withTenant(schoolId, async (tx) => {
    // Within the tenant context this returns the class only if it belongs to
    // the caller's school — prevents attaching a section to another tenant's class.
    const parent = await tx.class.findUnique({ where: { id: input.classId } });
    if (!parent) {
      throw new Error("Class not found");
    }
    return tx.section.create({
      data: { schoolId, classId: input.classId, name: input.name },
    });
  });
}

export async function deleteClass(id: string) {
  const { schoolId } = await requireSchool();
  // RLS hides other tenants' rows, so a foreign id deletes nothing (P2025).
  return withTenant(schoolId, (tx) => tx.class.delete({ where: { id } }));
}

export async function deleteSection(id: string) {
  const { schoolId } = await requireSchool();
  return withTenant(schoolId, (tx) => tx.section.delete({ where: { id } }));
}
