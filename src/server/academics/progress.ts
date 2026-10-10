import "server-only";

import type { AttendanceStatus, Prisma, RedFlagType } from "@prisma/client";
import type { Session } from "next-auth";

import { requireSchool } from "@/server/auth/dal";
import { withTenant } from "@/server/db/tenant";
import { normalizeMonth, presentRate } from "@/lib/attendance";
import { letterGrade, percentage } from "@/lib/grades";

/**
 * Student progress dashboard (Module 7.4): a read-only roll-up of a student's
 * attendance, exam results and open red flags. HEAD sees any student, TEACHER a
 * student in a class they're assigned to, PARENT only a linked child (and only
 * published exams, and no internal red flags). Tenant-scoped via `withTenant`.
 */

type StatusCounts = Record<AttendanceStatus, number> & { total: number };

function emptyCounts(): StatusCounts {
  return { PRESENT: 0, ABSENT: 0, LATE: 0, LEAVE: 0, total: 0 };
}

/** Half-open UTC range [start, end) for a "YYYY-MM" month. */
function monthRange(month: string): { start: Date; end: Date } {
  const [y, m] = month.split("-").map(Number);
  return { start: new Date(Date.UTC(y, m - 1, 1)), end: new Date(Date.UTC(y, m, 1)) };
}

/** A HEAD may access any class; a TEACHER only classes they're assigned to. */
async function assertCanAccessClass(
  tx: Prisma.TransactionClient,
  user: Session["user"],
  classId: string,
): Promise<void> {
  if (user.role === "HEAD") return;
  if (user.role === "TEACHER") {
    const assignment = await tx.teacherAssignment.findFirst({
      where: { teacherId: user.id, classId },
      select: { id: true },
    });
    if (!assignment) throw new Error("You are not assigned to this class");
    return;
  }
  throw new Error("Not allowed to view progress");
}

/** Who may view one student: HEAD (any), PARENT (linked child), TEACHER (assigned class). */
async function assertCanViewStudent(
  tx: Prisma.TransactionClient,
  user: Session["user"],
  studentId: string,
): Promise<void> {
  if (user.role === "HEAD") return;
  if (user.role === "PARENT") {
    const link = await tx.parentStudent.findFirst({
      where: { parentId: user.id, studentId },
      select: { id: true },
    });
    if (!link) throw new Error("This student is not linked to your account");
    return;
  }
  if (user.role === "TEACHER") {
    const student = await tx.student.findFirst({
      where: { id: studentId, class: { teacherAssignments: { some: { teacherId: user.id } } } },
      select: { id: true },
    });
    if (!student) throw new Error("You are not assigned to this student's class");
    return;
  }
  throw new Error("Not allowed to view progress");
}

export type ProgressExam = {
  examId: string;
  name: string;
  term: string | null;
  startDate: Date | null;
  isPublished: boolean;
  percentage: number | null;
  grade: string | null;
};

export type ProgressFlag = {
  id: string;
  type: RedFlagType;
  detail: string;
  createdAt: Date;
};

/** Full progress roll-up for one student. */
export async function getStudentProgress(studentId: string, input?: { month?: string }) {
  const { user, schoolId } = await requireSchool();
  const month = normalizeMonth(input?.month);
  return withTenant(schoolId, async (tx) => {
    const student = await tx.student.findUnique({
      where: { id: studentId },
      select: {
        id: true,
        name: true,
        rollNumber: true,
        class: { select: { name: true } },
        section: { select: { name: true } },
      },
    });
    if (!student) throw new Error("Student not found");
    await assertCanViewStudent(tx, user, studentId);
    const isParent = user.role === "PARENT";

    // Attendance: tally the current month and all-time.
    const records = await tx.attendance.findMany({
      where: { studentId },
      select: { date: true, status: true },
    });
    const { start, end } = monthRange(month);
    const overall = emptyCounts();
    const monthCounts = emptyCounts();
    for (const r of records) {
      overall[r.status] += 1;
      overall.total += 1;
      if (r.date >= start && r.date < end) {
        monthCounts[r.status] += 1;
        monthCounts.total += 1;
      }
    }

    // Exams: group this student's results by exam (parents see published only).
    const results = await tx.examResult.findMany({
      where: {
        studentId,
        ...(isParent ? { examSubject: { exam: { isPublished: true } } } : {}),
      },
      select: {
        isAbsent: true,
        marksObtained: true,
        examSubject: {
          select: {
            maxMarks: true,
            exam: {
              select: { id: true, name: true, term: true, startDate: true, isPublished: true },
            },
          },
        },
      },
    });
    const byExam = new Map<
      string,
      {
        exam: {
          id: string;
          name: string;
          term: string | null;
          startDate: Date | null;
          isPublished: boolean;
        };
        obtained: number;
        max: number;
        any: boolean;
      }
    >();
    for (const r of results) {
      const exam = r.examSubject.exam;
      const cur = byExam.get(exam.id) ?? { exam, obtained: 0, max: 0, any: false };
      if (!r.isAbsent && r.marksObtained !== null) {
        cur.obtained += Number(r.marksObtained);
        cur.max += Number(r.examSubject.maxMarks);
        cur.any = true;
      }
      byExam.set(exam.id, cur);
    }
    const exams: ProgressExam[] = [...byExam.values()]
      .map((e) => {
        const pct = e.any ? percentage(e.obtained, e.max) : null;
        return {
          examId: e.exam.id,
          name: e.exam.name,
          term: e.exam.term,
          startDate: e.exam.startDate,
          isPublished: e.exam.isPublished,
          percentage: pct,
          grade: pct !== null ? letterGrade(pct) : null,
        };
      })
      .sort((a, b) => {
        const at = a.startDate ? a.startDate.getTime() : 0;
        const bt = b.startDate ? b.startDate.getTime() : 0;
        return bt - at || a.name.localeCompare(b.name);
      });

    // Red flags: internal, so staff only.
    const openFlags: ProgressFlag[] = isParent
      ? []
      : await tx.redFlag.findMany({
          where: { studentId, status: "OPEN" },
          orderBy: { createdAt: "desc" },
          select: { id: true, type: true, detail: true, createdAt: true },
        });

    return {
      student,
      month,
      attendance: {
        month: monthCounts,
        overall,
        presentRate: presentRate(overall.PRESENT, overall.total),
      },
      exams,
      openFlags,
      canSeeFlags: !isParent,
    };
  });
}

export type ClassProgressRow = {
  student: {
    id: string;
    name: string;
    rollNumber: string | null;
    section: { name: string } | null;
  };
  presentRate: number | null;
  markedDays: number;
  openFlags: number;
};

/** Per-student quick stats for a class this month (HEAD any / TEACHER assigned). */
export async function listClassProgress(classId: string, input?: { month?: string }) {
  const { user, schoolId } = await requireSchool();
  const month = normalizeMonth(input?.month);
  return withTenant(schoolId, async (tx) => {
    const cls = await tx.class.findUnique({
      where: { id: classId },
      select: { id: true, name: true },
    });
    if (!cls) throw new Error("Class not found");
    await assertCanAccessClass(tx, user, classId);

    const students = await tx.student.findMany({
      where: { classId, isActive: true },
      orderBy: [{ rollNumber: "asc" }, { name: "asc" }],
      select: { id: true, name: true, rollNumber: true, section: { select: { name: true } } },
    });

    const { start, end } = monthRange(month);
    const [records, flags] = await Promise.all([
      tx.attendance.findMany({
        where: { classId, date: { gte: start, lt: end } },
        select: { studentId: true, status: true },
      }),
      tx.redFlag.findMany({
        where: { status: "OPEN", student: { classId } },
        select: { studentId: true },
      }),
    ]);

    const present = new Map<string, number>();
    const marked = new Map<string, number>();
    for (const r of records) {
      marked.set(r.studentId, (marked.get(r.studentId) ?? 0) + 1);
      if (r.status === "PRESENT") present.set(r.studentId, (present.get(r.studentId) ?? 0) + 1);
    }
    const flagCount = new Map<string, number>();
    for (const f of flags) flagCount.set(f.studentId, (flagCount.get(f.studentId) ?? 0) + 1);

    const rows: ClassProgressRow[] = students.map((s) => {
      const total = marked.get(s.id) ?? 0;
      return {
        student: s,
        presentRate: presentRate(present.get(s.id) ?? 0, total),
        markedDays: total,
        openFlags: flagCount.get(s.id) ?? 0,
      };
    });

    return { class: cls, month, rows };
  });
}

export type ChildProgressRow = {
  student: {
    id: string;
    name: string;
    class: { name: string } | null;
    section: { name: string } | null;
  };
  presentRate: number | null;
  markedDays: number;
};

/** The signed-in parent's children with this month's attendance snapshot. */
export async function listChildrenProgress(input?: { month?: string }) {
  const { user, schoolId } = await requireSchool();
  const month = normalizeMonth(input?.month);
  return withTenant(schoolId, async (tx) => {
    const links = await tx.parentStudent.findMany({
      where: { parentId: user.id },
      orderBy: { createdAt: "asc" },
      select: {
        student: {
          select: {
            id: true,
            name: true,
            class: { select: { name: true } },
            section: { select: { name: true } },
          },
        },
      },
    });

    const { start, end } = monthRange(month);
    const children: ChildProgressRow[] = [];
    for (const { student } of links) {
      const records = await tx.attendance.findMany({
        where: { studentId: student.id, date: { gte: start, lt: end } },
        select: { status: true },
      });
      let present = 0;
      for (const r of records) if (r.status === "PRESENT") present += 1;
      children.push({
        student,
        presentRate: presentRate(present, records.length),
        markedDays: records.length,
      });
    }

    return { month, children };
  });
}
