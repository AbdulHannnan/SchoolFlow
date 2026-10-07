import "server-only";

import type { Gender } from "@prisma/client";

import { requireSchool, withCurrentTenant } from "@/server/auth/dal";
import { withTenant } from "@/server/db/tenant";

/** Students (Module 2.4). Tenant-scoped; roles enforced in the actions. */

export function listStudents() {
  return withCurrentTenant((tx) =>
    tx.student.findMany({
      orderBy: [{ class: { name: "asc" } }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        rollNumber: true,
        gender: true,
        isActive: true,
        class: { select: { id: true, name: true } },
        section: { select: { id: true, name: true } },
      },
    }),
  );
}

export async function createStudent(input: {
  name: string;
  rollNumber: string | null;
  classId: string;
  sectionId: string | null;
  gender: Gender | null;
  dateOfBirth: Date | null;
}) {
  const { schoolId } = await requireSchool();
  return withTenant(schoolId, async (tx) => {
    // Class must be in this tenant (RLS); section (if any) must belong to it.
    const cls = await tx.class.findUnique({ where: { id: input.classId } });
    if (!cls) throw new Error("Class not found");
    if (input.sectionId) {
      const section = await tx.section.findUnique({ where: { id: input.sectionId } });
      if (!section || section.classId !== input.classId) {
        throw new Error("Section does not belong to the selected class");
      }
    }
    return tx.student.create({
      data: {
        schoolId,
        classId: input.classId,
        sectionId: input.sectionId,
        name: input.name,
        rollNumber: input.rollNumber,
        gender: input.gender,
        dateOfBirth: input.dateOfBirth,
      },
    });
  });
}

export async function deleteStudent(id: string) {
  const { schoolId } = await requireSchool();
  return withTenant(schoolId, (tx) => tx.student.deleteMany({ where: { id } }));
}
