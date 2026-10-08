import "server-only";

import type { Prisma } from "@prisma/client";
import type { AttendanceStatus } from "@prisma/client";
import type { Session } from "next-auth";

import { requireSchool } from "@/server/auth/dal";
import { withTenant } from "@/server/db/tenant";

/**
 * Attendance (Module 3.1). Daily, one record per student per calendar day.
 * Tenant-scoped; roles are enforced in the route actions. Reads and writes both
 * use `withTenant` so RLS pins every row to the acting user's school.
 */

/** Normalize any Date to UTC midnight so it round-trips a `@db.Date` column. */
export function toDateOnly(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/**
 * A HEAD may mark any class; a TEACHER only classes they're assigned to. This
 * is the row-level authorization behind the route's role gate — it runs inside
 * the tenant context so the lookup can't see another school.
 */
async function assertCanMarkClass(
  tx: Prisma.TransactionClient,
  user: Session["user"],
  classId: string,
): Promise<void> {
  if (user.role === "HEAD") return;
  const assignment = await tx.teacherAssignment.findFirst({
    where: { teacherId: user.id, classId },
    select: { id: true },
  });
  if (!assignment) throw new Error("You are not assigned to this class");
}

/** Classes the current user may take attendance for (HEAD: all; TEACHER: assigned). */
export async function listMarkableClasses() {
  const { user, schoolId } = await requireSchool();
  return withTenant(schoolId, (tx) =>
    tx.class.findMany({
      where:
        user.role === "TEACHER" ? { teacherAssignments: { some: { teacherId: user.id } } } : {},
      orderBy: [{ level: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        sections: { orderBy: { name: "asc" }, select: { id: true, name: true } },
      },
    }),
  );
}

export type AttendanceEntry = {
  studentId: string;
  status: AttendanceStatus;
  note: string | null;
};

/** A class roster for one date, each student paired with that day's record (if any). */
export async function getClassAttendanceForDate(input: {
  classId: string;
  sectionId: string | null;
  date: Date;
}) {
  const { user, schoolId } = await requireSchool();
  const date = toDateOnly(input.date);
  return withTenant(schoolId, async (tx) => {
    const cls = await tx.class.findUnique({
      where: { id: input.classId },
      select: { id: true, name: true },
    });
    if (!cls) throw new Error("Class not found");
    await assertCanMarkClass(tx, user, input.classId);

    const students = await tx.student.findMany({
      where: {
        classId: input.classId,
        ...(input.sectionId ? { sectionId: input.sectionId } : {}),
        isActive: true,
      },
      orderBy: [{ rollNumber: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        rollNumber: true,
        section: { select: { id: true, name: true } },
        attendance: {
          where: { date },
          select: { id: true, status: true, note: true },
          take: 1,
        },
      },
    });

    return {
      class: cls,
      date,
      roster: students.map((s) => ({
        studentId: s.id,
        name: s.name,
        rollNumber: s.rollNumber,
        section: s.section,
        record: s.attendance[0] ?? null,
      })),
    };
  });
}

/**
 * Record (or overwrite) attendance for a class on a date. Idempotent per
 * student via the `(studentId, date)` unique key. Each student's class/section
 * is captured from their current record so historical reports stay correct
 * after a promotion. Entries for students not in this class/section are
 * rejected (FK targets are re-checked in-tenant; see the RLS FK gap note).
 */
export async function saveClassAttendance(input: {
  classId: string;
  sectionId: string | null;
  date: Date;
  entries: AttendanceEntry[];
}) {
  const { user, schoolId } = await requireSchool();
  const date = toDateOnly(input.date);
  return withTenant(schoolId, async (tx) => {
    const cls = await tx.class.findUnique({ where: { id: input.classId } });
    if (!cls) throw new Error("Class not found");
    await assertCanMarkClass(tx, user, input.classId);

    // Build the set of students that legitimately belong to this class (and
    // section, if one was chosen) within the tenant.
    const students = await tx.student.findMany({
      where: {
        classId: input.classId,
        ...(input.sectionId ? { sectionId: input.sectionId } : {}),
      },
      select: { id: true, sectionId: true },
    });
    const sectionByStudent = new Map(students.map((s) => [s.id, s.sectionId]));

    let saved = 0;
    for (const entry of input.entries) {
      if (!sectionByStudent.has(entry.studentId)) {
        throw new Error("Student does not belong to the selected class");
      }
      const note = entry.note?.trim() ? entry.note.trim() : null;
      await tx.attendance.upsert({
        where: { studentId_date: { studentId: entry.studentId, date } },
        create: {
          schoolId,
          studentId: entry.studentId,
          classId: input.classId,
          sectionId: sectionByStudent.get(entry.studentId) ?? null,
          date,
          status: entry.status,
          note,
          markedById: user.id,
        },
        update: {
          status: entry.status,
          note,
          sectionId: sectionByStudent.get(entry.studentId) ?? null,
          markedById: user.id,
        },
      });
      saved += 1;
    }
    return { saved };
  });
}
