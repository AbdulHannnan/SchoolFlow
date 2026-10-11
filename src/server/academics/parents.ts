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

export async function createParent(input: {
  name: string;
  email: string;
  password: string;
  cnic: string | null;
  phone: string | null;
}) {
  const { schoolId } = await requireSchool();
  const passwordHash = await hashPassword(input.password);
  return withTenant(schoolId, (tx) =>
    tx.user.create({
      data: {
        schoolId,
        email: input.email,
        name: input.name,
        role: "PARENT",
        passwordHash,
        cnic: input.cnic,
        phone: input.phone,
      },
    }),
  );
}

/** Classes (grades) with the number of distinct parents who have a child in
 * each, for the Parents-by-grade overview. */
export async function getParentsByGradeOverview() {
  return withCurrentTenant(async (tx) => {
    const classes = await tx.class.findMany({
      orderBy: [{ level: "asc" }, { name: "asc" }],
      select: { id: true, name: true, level: true },
    });
    const links = await tx.parentStudent.findMany({
      select: { parentId: true, student: { select: { classId: true } } },
    });
    const parentsByClass = new Map<string, Set<string>>();
    for (const l of links) {
      const cid = l.student.classId;
      if (!parentsByClass.has(cid)) parentsByClass.set(cid, new Set());
      parentsByClass.get(cid)!.add(l.parentId);
    }
    return classes.map((c) => ({ ...c, parentCount: parentsByClass.get(c.id)?.size ?? 0 }));
  });
}

/** One grade's parents: a row per (parent, child in this grade) with the
 * parent's CNIC and contact, the child's name and grade. */
export async function listParentsByGrade(classId: string) {
  return withCurrentTenant(async (tx) => {
    const cls = await tx.class.findUnique({
      where: { id: classId },
      select: { id: true, name: true },
    });
    if (!cls) throw new Error("Class not found");
    const links = await tx.parentStudent.findMany({
      where: { student: { classId } },
      orderBy: [{ parent: { name: "asc" } }, { student: { name: "asc" } }],
      select: {
        id: true,
        relation: true,
        parent: { select: { id: true, name: true, cnic: true, phone: true } },
        student: { select: { id: true, name: true, class: { select: { name: true } } } },
      },
    });
    return { class: cls, links };
  });
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
