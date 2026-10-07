import "server-only";

import type { GuardianRelation } from "@prisma/client";

import { requireSchool, withCurrentTenant } from "@/server/auth/dal";
import { withTenant } from "@/server/db/tenant";
import { hashPassword } from "@/server/auth/password";

/** Parents (Module 2.5). A parent is a User with role PARENT, linked to one or
 * more students. Tenant-scoped; roles enforced in the actions. */

export function listParents() {
  return withCurrentTenant((tx) =>
    tx.user.findMany({
      where: { role: "PARENT" },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        email: true,
        parentLinks: {
          select: {
            id: true,
            relation: true,
            student: { select: { id: true, name: true, class: { select: { name: true } } } },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    }),
  );
}

export async function createParent(input: { name: string; email: string; password: string }) {
  const { schoolId } = await requireSchool();
  const passwordHash = await hashPassword(input.password);
  return withTenant(schoolId, (tx) =>
    tx.user.create({
      data: { schoolId, email: input.email, name: input.name, role: "PARENT", passwordHash },
    }),
  );
}

export async function deleteParent(id: string) {
  const { schoolId } = await requireSchool();
  return withTenant(schoolId, (tx) => tx.user.deleteMany({ where: { id, role: "PARENT" } }));
}

export async function linkStudent(input: {
  parentId: string;
  studentId: string;
  relation: GuardianRelation | null;
}) {
  const { schoolId } = await requireSchool();
  return withTenant(schoolId, async (tx) => {
    const [parent, student] = await Promise.all([
      tx.user.findFirst({ where: { id: input.parentId, role: "PARENT" } }),
      tx.student.findUnique({ where: { id: input.studentId } }),
    ]);
    if (!parent) throw new Error("Parent not found");
    if (!student) throw new Error("Student not found");
    return tx.parentStudent.create({
      data: {
        schoolId,
        parentId: input.parentId,
        studentId: input.studentId,
        relation: input.relation,
      },
    });
  });
}

export async function unlinkStudent(id: string) {
  const { schoolId } = await requireSchool();
  return withTenant(schoolId, (tx) => tx.parentStudent.deleteMany({ where: { id } }));
}
