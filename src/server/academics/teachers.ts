import "server-only";

import { requireSchool, withCurrentTenant } from "@/server/auth/dal";
import { withTenant } from "@/server/db/tenant";
import { hashPassword } from "@/server/auth/password";

/**
 * Teachers (Module 2.3). A teacher is a User with role TEACHER, scoped to the
 * school. Assignments link a teacher to a subject within a class. All writes
 * run in the tenant RLS context; role enforcement (HEAD) lives in the actions.
 */

export function listTeachers() {
  return withCurrentTenant((tx) =>
    tx.user.findMany({
      where: { role: "TEACHER" },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        email: true,
        isActive: true,
        teacherAssignments: {
          select: {
            id: true,
            subject: { select: { id: true, name: true } },
            class: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    }),
  );
}

export async function createTeacher(input: { name: string; email: string; password: string }) {
  const { schoolId } = await requireSchool();
  const passwordHash = await hashPassword(input.password);
  return withTenant(schoolId, (tx) =>
    tx.user.create({
      data: { schoolId, email: input.email, name: input.name, role: "TEACHER", passwordHash },
    }),
  );
}

export async function deleteTeacher(id: string) {
  const { schoolId } = await requireSchool();
  // deleteMany + role filter so only TEACHER accounts can be removed here
  // (a stray HEAD id deletes nothing). RLS already pins to this school.
  return withTenant(schoolId, (tx) => tx.user.deleteMany({ where: { id, role: "TEACHER" } }));
}

export async function createAssignment(input: {
  teacherId: string;
  subjectId: string;
  classId: string;
}) {
  const { schoolId } = await requireSchool();
  return withTenant(schoolId, async (tx) => {
    // All three must be visible in this tenant's context (RLS), so a foreign id
    // can't be smuggled in.
    const [teacher, subject, cls] = await Promise.all([
      tx.user.findFirst({ where: { id: input.teacherId, role: "TEACHER" } }),
      tx.subject.findUnique({ where: { id: input.subjectId } }),
      tx.class.findUnique({ where: { id: input.classId } }),
    ]);
    if (!teacher) throw new Error("Teacher not found");
    if (!subject) throw new Error("Subject not found");
    if (!cls) throw new Error("Class not found");

    return tx.teacherAssignment.create({
      data: {
        schoolId,
        teacherId: input.teacherId,
        subjectId: input.subjectId,
        classId: input.classId,
      },
    });
  });
}

export async function deleteAssignment(id: string) {
  const { schoolId } = await requireSchool();
  return withTenant(schoolId, (tx) => tx.teacherAssignment.delete({ where: { id } }));
}
