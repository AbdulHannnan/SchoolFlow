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

/** One class's roster: the class (id + name) and its students, for the
 * drill-down on the Students page. Tenant-scoped; a foreign id resolves to
 * nothing under RLS, so it throws "Class not found". */
export async function listStudentsByClass(classId: string) {
  return withCurrentTenant(async (tx) => {
    const cls = await tx.class.findUnique({
      where: { id: classId },
      select: { id: true, name: true },
    });
    if (!cls) throw new Error("Class not found");
    const students = await tx.student.findMany({
      where: { classId },
      orderBy: [{ rollNumber: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        rollNumber: true,
        fatherName: true,
        fatherCnic: true,
        gender: true,
        dateOfBirth: true,
        admissionDate: true,
        isActive: true,
        section: { select: { id: true, name: true } },
      },
    });
    return { class: cls, students };
  });
}

/**
 * One of the signed-in teacher's own classes and its roster. Returns the class
 * only when the teacher holds a subject assignment in it (same ownership rule
 * as the rest of the teacher scope), so a teacher can't read another class's
 * students by guessing its id.
 */
export async function listMyClassStudents(classId: string) {
  const { user, schoolId } = await requireSchool();
  return withTenant(schoolId, async (tx) => {
    const cls = await tx.class.findFirst({
      where: { id: classId, teacherAssignments: { some: { teacherId: user.id } } },
      select: { id: true, name: true },
    });
    if (!cls) throw new Error("Class not found");
    const students = await tx.student.findMany({
      where: { classId },
      orderBy: [{ rollNumber: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        rollNumber: true,
        fatherName: true,
        fatherCnic: true,
        gender: true,
        dateOfBirth: true,
        admissionDate: true,
        isActive: true,
        section: { select: { id: true, name: true } },
      },
    });
    return { class: cls, students };
  });
}

export async function createStudent(input: {
  name: string;
  rollNumber: string | null;
  fatherName: string | null;
  fatherCnic: string | null;
  classId: string;
  sectionId: string | null;
  gender: Gender | null;
  dateOfBirth: Date | null;
  admissionDate: Date | null;
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
        fatherName: input.fatherName,
        fatherCnic: input.fatherCnic,
        gender: input.gender,
        dateOfBirth: input.dateOfBirth,
        admissionDate: input.admissionDate,
      },
    });
  });
}

export async function updateStudent(input: {
  id: string;
  name: string;
  rollNumber: string | null;
  fatherName: string | null;
  fatherCnic: string | null;
  classId: string;
  sectionId: string | null;
  gender: Gender | null;
  dateOfBirth: Date | null;
  admissionDate: Date | null;
  isActive: boolean;
}) {
  const { schoolId } = await requireSchool();
  return withTenant(schoolId, async (tx) => {
    // RLS hides other tenants' rows, so a foreign id resolves to nothing here.
    const existing = await tx.student.findUnique({
      where: { id: input.id },
      select: { id: true },
    });
    if (!existing) throw new Error("Student not found");
    // Class must be in this tenant; section (if any) must belong to it.
    const cls = await tx.class.findUnique({ where: { id: input.classId } });
    if (!cls) throw new Error("Class not found");
    if (input.sectionId) {
      const section = await tx.section.findUnique({ where: { id: input.sectionId } });
      if (!section || section.classId !== input.classId) {
        throw new Error("Section does not belong to the selected class");
      }
    }
    return tx.student.update({
      where: { id: input.id },
      data: {
        classId: input.classId,
        sectionId: input.sectionId,
        name: input.name,
        rollNumber: input.rollNumber,
        fatherName: input.fatherName,
        fatherCnic: input.fatherCnic,
        gender: input.gender,
        dateOfBirth: input.dateOfBirth,
        admissionDate: input.admissionDate,
        isActive: input.isActive,
      },
    });
  });
}

export async function deleteStudent(id: string) {
  const { schoolId } = await requireSchool();
  return withTenant(schoolId, (tx) => tx.student.deleteMany({ where: { id } }));
}
