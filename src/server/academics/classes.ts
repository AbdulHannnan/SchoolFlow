import "server-only";

import type { Prisma } from "@prisma/client";

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
      include: {
        sections: {
          orderBy: { name: "asc" },
          include: {
            sectionTeacher: { select: { id: true, name: true } },
            _count: { select: { students: true } },
          },
        },
        classTeacher: { select: { id: true, name: true } },
        _count: { select: { students: true } },
      },
    }),
  );
}

/** Active teachers (id + name) for the class-teacher picker. */
export function listTeacherOptions() {
  return withCurrentTenant((tx) =>
    tx.user.findMany({
      where: { role: "TEACHER", isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  );
}

export async function createClass(input: {
  name: string;
  level: number | null;
  classTeacherId: string | null;
  hasSections: boolean;
}) {
  const { schoolId } = await requireSchool();
  return withTenant(schoolId, async (tx) => {
    // RLS doesn't guard FK targets, so re-check the teacher resolves in-tenant
    // (same school, role TEACHER) before pinning them as the class teacher.
    if (input.classTeacherId) {
      const teacher = await tx.user.findFirst({
        where: { id: input.classTeacherId, role: "TEACHER" },
        select: { id: true },
      });
      if (!teacher) throw new Error("Selected class teacher was not found");
    }
    return tx.class.create({
      data: {
        schoolId,
        name: input.name,
        level: input.level,
        classTeacherId: input.classTeacherId,
        hasSections: input.hasSections,
      },
    });
  });
}

export async function updateClass(input: {
  id: string;
  name: string;
  level: number | null;
  classTeacherId: string | null;
}) {
  const { schoolId } = await requireSchool();
  return withTenant(schoolId, async (tx) => {
    // RLS hides other tenants' rows, so a foreign id resolves to nothing here.
    const existing = await tx.class.findUnique({ where: { id: input.id }, select: { id: true } });
    if (!existing) throw new Error("Class not found");
    // Re-check the teacher resolves in-tenant with role TEACHER (RLS doesn't
    // guard FK targets), as createClass does.
    if (input.classTeacherId) {
      const teacher = await tx.user.findFirst({
        where: { id: input.classTeacherId, role: "TEACHER" },
        select: { id: true },
      });
      if (!teacher) throw new Error("Selected class teacher was not found");
    }
    return tx.class.update({
      where: { id: input.id },
      data: { name: input.name, level: input.level, classTeacherId: input.classTeacherId },
    });
  });
}

/** Re-check a section teacher resolves in-tenant with role TEACHER (RLS doesn't
 * guard FK targets). No-op for a null id. */
async function assertSectionTeacher(
  tx: Prisma.TransactionClient,
  sectionTeacherId: string | null,
): Promise<void> {
  if (!sectionTeacherId) return;
  const teacher = await tx.user.findFirst({
    where: { id: sectionTeacherId, role: "TEACHER" },
    select: { id: true },
  });
  if (!teacher) throw new Error("Selected section teacher was not found");
}

export async function createSection(input: {
  classId: string;
  name: string;
  sectionTeacherId: string | null;
}) {
  const { schoolId } = await requireSchool();
  return withTenant(schoolId, async (tx) => {
    // Within the tenant context this returns the class only if it belongs to
    // the caller's school - prevents attaching a section to another tenant's class.
    const parent = await tx.class.findUnique({ where: { id: input.classId } });
    if (!parent) {
      throw new Error("Class not found");
    }
    await assertSectionTeacher(tx, input.sectionTeacherId);
    return tx.section.create({
      data: {
        schoolId,
        classId: input.classId,
        name: input.name,
        sectionTeacherId: input.sectionTeacherId,
      },
    });
  });
}

export async function updateSection(input: {
  id: string;
  name: string;
  sectionTeacherId: string | null;
}) {
  const { schoolId } = await requireSchool();
  return withTenant(schoolId, async (tx) => {
    const existing = await tx.section.findUnique({
      where: { id: input.id },
      select: { id: true },
    });
    if (!existing) throw new Error("Section not found");
    await assertSectionTeacher(tx, input.sectionTeacherId);
    return tx.section.update({
      where: { id: input.id },
      data: { name: input.name, sectionTeacherId: input.sectionTeacherId },
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
