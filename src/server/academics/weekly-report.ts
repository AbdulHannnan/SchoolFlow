import "server-only";

import type { Prisma } from "@prisma/client";

import { requireSchool } from "@/server/auth/dal";
import { withTenant } from "@/server/db/tenant";
import { dispatch } from "@/server/notifications/dispatch";
import { formatDay } from "@/lib/attendance";
import { letterGrade, percentage } from "@/lib/grades";

/**
 * Weekly student reports (WhatsApp, HEAD-initiated).
 *
 * A HEAD sends a parent a once-a-week snapshot of their child: the week's
 * attendance, the student's latest published-exam performance, and any open
 * red flags (fees are deliberately excluded). The report fans out through the
 * notification engine to the student's linked parents on in-app + WhatsApp,
 * exactly like fee reminders — recipients are resolved to `User.phone` by the
 * WhatsApp channel, never trusted from the caller, and tenant-scoped via RLS.
 *
 * Gating: the send is blocked until the school has set its own WhatsApp sender
 * number (`School.whatsappNumber`), which is left blank for now. Everything
 * else is wired, so filling that number in (plus the Cloud API env the channel
 * already needs) turns the feature on with no further code change.
 */

export type WeeklyReportResult = {
  /** False when the school has no WhatsApp sender number set yet (nothing sent). */
  configured: boolean;
  /** Students a report was sent for (had a built report and >=1 linked parent). */
  students: number;
  /** Total parent recipients the report was dispatched to. */
  reports: number;
  /** Students skipped because they have no linked parent. */
  skipped: number;
  /** Human-readable week the report covers, e.g. "27 Oct 2026 - 02 Nov 2026". */
  weekLabel: string;
};

type StudentReport = {
  studentId: string;
  studentName: string;
  attendance: string;
  performance: string;
  redFlags: string;
};

/** Half-open UTC range [start, end) for the Monday–Sunday week containing `ref`. */
function currentWeekRange(ref = new Date()): { start: Date; end: Date } {
  const day = ref.getUTCDay(); // 0 = Sun … 6 = Sat
  const sinceMonday = day === 0 ? 6 : day - 1;
  const start = new Date(
    Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth(), ref.getUTCDate() - sinceMonday),
  );
  const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
  return { start, end };
}

/** "27 Oct 2026 - 02 Nov 2026" for the week range (end is exclusive). */
function weekLabel(start: Date, end: Date): string {
  const lastDay = new Date(end.getTime() - 24 * 60 * 60 * 1000);
  return `${formatDay(start)} - ${formatDay(lastDay)}`;
}

/**
 * Build a weekly report line-set for every active student matched by `where`,
 * within one tenant transaction. Returns the per-student report fields plus the
 * parent recipients for each student. All queries run sequentially: they share
 * the transaction's single pinned connection (node-postgres adapter).
 */
async function collectReports(
  tx: Prisma.TransactionClient,
  where: Prisma.StudentWhereInput,
  range: { start: Date; end: Date },
): Promise<{ reports: StudentReport[]; parentsByStudent: Map<string, string[]>; skipped: number }> {
  const students = await tx.student.findMany({
    where: { isActive: true, ...where },
    orderBy: [{ rollNumber: "asc" }, { name: "asc" }],
    select: { id: true, name: true },
  });
  if (students.length === 0) {
    return { reports: [], parentsByStudent: new Map(), skipped: 0 };
  }
  const studentIds = students.map((s) => s.id);

  // Attendance within the week, tallied per student.
  const records = await tx.attendance.findMany({
    where: { studentId: { in: studentIds }, date: { gte: range.start, lt: range.end } },
    select: { studentId: true, status: true },
  });
  type Tally = { present: number; absent: number; late: number; leave: number; total: number };
  const tallies = new Map<string, Tally>();
  for (const r of records) {
    const t = tallies.get(r.studentId) ?? { present: 0, absent: 0, late: 0, leave: 0, total: 0 };
    if (r.status === "PRESENT") t.present += 1;
    else if (r.status === "ABSENT") t.absent += 1;
    else if (r.status === "LATE") t.late += 1;
    else if (r.status === "LEAVE") t.leave += 1;
    t.total += 1;
    tallies.set(r.studentId, t);
  }

  // Latest published-exam performance: obtained/max per student per exam, keep
  // the most recent exam's overall percentage (mirrors listClassProgress).
  const results = await tx.examResult.findMany({
    where: { studentId: { in: studentIds }, examSubject: { exam: { isPublished: true } } },
    select: {
      studentId: true,
      isAbsent: true,
      marksObtained: true,
      examSubject: {
        select: {
          maxMarks: true,
          exam: { select: { id: true, name: true, startDate: true, createdAt: true } },
        },
      },
    },
  });
  type ExamAccum = { name: string; sortKey: number; obtained: number; max: number; any: boolean };
  const examsByStudent = new Map<string, Map<string, ExamAccum>>();
  for (const r of results) {
    const exam = r.examSubject.exam;
    let byExam = examsByStudent.get(r.studentId);
    if (!byExam) {
      byExam = new Map();
      examsByStudent.set(r.studentId, byExam);
    }
    const sortKey = (exam.startDate ?? exam.createdAt).getTime();
    const cur = byExam.get(exam.id) ?? {
      name: exam.name,
      sortKey,
      obtained: 0,
      max: 0,
      any: false,
    };
    if (!r.isAbsent && r.marksObtained !== null) {
      cur.obtained += Number(r.marksObtained);
      cur.max += Number(r.examSubject.maxMarks);
      cur.any = true;
    }
    byExam.set(exam.id, cur);
  }

  // Open red flags per student (titles de-duplicated for a short summary).
  const flags = await tx.redFlag.findMany({
    where: { studentId: { in: studentIds }, status: "OPEN" },
    orderBy: { createdAt: "desc" },
    select: { studentId: true, title: true },
  });
  const flagsByStudent = new Map<string, string[]>();
  for (const f of flags) {
    const list = flagsByStudent.get(f.studentId) ?? [];
    list.push(f.title);
    flagsByStudent.set(f.studentId, list);
  }

  // Parent links for the recipients.
  const links = await tx.parentStudent.findMany({
    where: { studentId: { in: studentIds } },
    select: { studentId: true, parentId: true },
  });
  const parentsByStudent = new Map<string, string[]>();
  for (const link of links) {
    const list = parentsByStudent.get(link.studentId) ?? [];
    list.push(link.parentId);
    parentsByStudent.set(link.studentId, list);
  }

  const reports: StudentReport[] = [];
  let skipped = 0;
  for (const s of students) {
    if (!parentsByStudent.has(s.id)) {
      skipped += 1;
      continue;
    }

    const t = tallies.get(s.id);
    const attendance = t
      ? `Present ${t.present}, Absent ${t.absent}, Late ${t.late}, Leave ${t.leave} (${t.total} marked)`
      : "No attendance marked this week";

    const scored = [...(examsByStudent.get(s.id)?.values() ?? [])]
      .filter((e) => e.any)
      .sort((a, b) => b.sortKey - a.sortKey);
    const latest = scored[0];
    const pct = latest ? percentage(latest.obtained, latest.max) : null;
    const performance =
      latest && pct !== null
        ? `${latest.name}: ${pct}% (${letterGrade(pct)})`
        : "No exam results yet";

    const flagTitles = [...new Set(flagsByStudent.get(s.id) ?? [])];
    const redFlags =
      flagTitles.length === 0 ? "None" : `${flagTitles.length} open - ${flagTitles.join(", ")}`;

    reports.push({ studentId: s.id, studentName: s.name, attendance, performance, redFlags });
  }

  return { reports, parentsByStudent, skipped };
}

/** The school's configured WhatsApp sender number, or null when unset/blank. */
async function getSchoolWhatsappNumber(tx: Prisma.TransactionClient, schoolId: string) {
  const school = await tx.school.findUnique({
    where: { id: schoolId },
    select: { whatsappNumber: true },
  });
  const num = school?.whatsappNumber?.trim();
  return num ? num : null;
}

export type StudentWeeklyReportView = {
  weekLabel: string;
  /** True once the school has set its WhatsApp sender number. */
  whatsappConfigured: boolean;
  /** How many parents are linked (0 means the report can't be sent to anyone). */
  parentCount: number;
  school: { name: string };
  student: {
    id: string;
    name: string;
    rollNumber: string | null;
    className: string | null;
    sectionName: string | null;
  };
  attendance: { present: number; absent: number; late: number; leave: number; total: number };
  performance: { examName: string; percent: number; grade: string } | null;
  openFlags: { id: string; title: string; detail: string; createdAt: Date }[];
};

/**
 * Read a single student's weekly report for display (the "open report" view on
 * the students page). Same week window and figures the send uses, but shaped
 * for rendering a classic report rather than a WhatsApp line. HEAD-only in
 * practice: the calling page requires HEAD.
 */
export async function getStudentWeeklyReport(studentId: string): Promise<StudentWeeklyReportView> {
  const { schoolId } = await requireSchool();
  const { start, end } = currentWeekRange();
  const label = weekLabel(start, end);

  return withTenant(schoolId, async (tx) => {
    const school = await tx.school.findUnique({
      where: { id: schoolId },
      select: { name: true, whatsappNumber: true },
    });
    if (!school) throw new Error("School not found");

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

    // Week attendance tally.
    const records = await tx.attendance.findMany({
      where: { studentId, date: { gte: start, lt: end } },
      select: { status: true },
    });
    const attendance = { present: 0, absent: 0, late: 0, leave: 0, total: 0 };
    for (const r of records) {
      if (r.status === "PRESENT") attendance.present += 1;
      else if (r.status === "ABSENT") attendance.absent += 1;
      else if (r.status === "LATE") attendance.late += 1;
      else if (r.status === "LEAVE") attendance.leave += 1;
      attendance.total += 1;
    }

    // Latest published-exam overall performance.
    const results = await tx.examResult.findMany({
      where: { studentId, examSubject: { exam: { isPublished: true } } },
      select: {
        isAbsent: true,
        marksObtained: true,
        examSubject: {
          select: {
            maxMarks: true,
            exam: { select: { id: true, name: true, startDate: true, createdAt: true } },
          },
        },
      },
    });
    const byExam = new Map<
      string,
      { name: string; sortKey: number; obtained: number; max: number; any: boolean }
    >();
    for (const r of results) {
      const exam = r.examSubject.exam;
      const cur = byExam.get(exam.id) ?? {
        name: exam.name,
        sortKey: (exam.startDate ?? exam.createdAt).getTime(),
        obtained: 0,
        max: 0,
        any: false,
      };
      if (!r.isAbsent && r.marksObtained !== null) {
        cur.obtained += Number(r.marksObtained);
        cur.max += Number(r.examSubject.maxMarks);
        cur.any = true;
      }
      byExam.set(exam.id, cur);
    }
    const latest = [...byExam.values()]
      .filter((e) => e.any)
      .sort((a, b) => b.sortKey - a.sortKey)[0];
    const pct = latest ? percentage(latest.obtained, latest.max) : null;
    const performance =
      latest && pct !== null
        ? { examName: latest.name, percent: pct, grade: letterGrade(pct) }
        : null;

    const openFlags = await tx.redFlag.findMany({
      where: { studentId, status: "OPEN" },
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true, detail: true, createdAt: true },
    });

    const parentCount = await tx.parentStudent.count({ where: { studentId } });

    return {
      weekLabel: label,
      whatsappConfigured: !!school.whatsappNumber?.trim(),
      parentCount,
      school: { name: school.name },
      student: {
        id: student.id,
        name: student.name,
        rollNumber: student.rollNumber,
        className: student.class?.name ?? null,
        sectionName: student.section?.name ?? null,
      },
      attendance,
      performance,
      openFlags,
    };
  });
}

/** Dispatch the collected reports to each student's parents. Shared by the
 * single-student and whole-class entry points. */
async function sendReports(
  schoolId: string,
  reports: StudentReport[],
  parentsByStudent: Map<string, string[]>,
  label: string,
): Promise<number> {
  let recipients = 0;
  for (const r of reports) {
    const parentIds = parentsByStudent.get(r.studentId) ?? [];
    if (parentIds.length === 0) continue;
    await dispatch({
      type: "WEEKLY_REPORT",
      schoolId,
      recipientIds: parentIds,
      studentId: r.studentId,
      studentName: r.studentName,
      weekLabel: label,
      attendance: r.attendance,
      performance: r.performance,
      redFlags: r.redFlags,
      channels: ["in-app", "whatsapp"],
    });
    recipients += parentIds.length;
  }
  return recipients;
}

/** Send one student's weekly report to their linked parent(s). The HEAD-only
 * check is enforced by the calling Server Action (like fee reminders). */
export async function sendStudentWeeklyReport(studentId: string): Promise<WeeklyReportResult> {
  const { schoolId } = await requireSchool();
  const { start, end } = currentWeekRange();
  const label = weekLabel(start, end);

  const { configured, reports, parentsByStudent, skipped } = await withTenant(
    schoolId,
    async (tx) => {
      const number = await getSchoolWhatsappNumber(tx, schoolId);
      if (!number) {
        return { configured: false, reports: [], parentsByStudent: new Map(), skipped: 0 };
      }
      const student = await tx.student.findUnique({
        where: { id: studentId },
        select: { id: true },
      });
      if (!student) throw new Error("Student not found");
      const collected = await collectReports(tx, { id: studentId }, { start, end });
      return { configured: true as const, ...collected };
    },
  );

  if (!configured) {
    return { configured: false, students: 0, reports: 0, skipped: 0, weekLabel: label };
  }

  const recipients = await sendReports(schoolId, reports, parentsByStudent, label);
  return {
    configured: true,
    students: reports.length,
    reports: recipients,
    skipped,
    weekLabel: label,
  };
}

/** Send a weekly report for every active student in a class to each student's
 * linked parent(s). HEAD only. */
export async function sendClassWeeklyReports(classId: string): Promise<WeeklyReportResult> {
  const { schoolId } = await requireSchool();
  const { start, end } = currentWeekRange();
  const label = weekLabel(start, end);

  const { configured, reports, parentsByStudent, skipped } = await withTenant(
    schoolId,
    async (tx) => {
      const number = await getSchoolWhatsappNumber(tx, schoolId);
      if (!number) {
        return { configured: false, reports: [], parentsByStudent: new Map(), skipped: 0 };
      }
      const cls = await tx.class.findUnique({ where: { id: classId }, select: { id: true } });
      if (!cls) throw new Error("Class not found");
      const collected = await collectReports(tx, { classId }, { start, end });
      return { configured: true as const, ...collected };
    },
  );

  if (!configured) {
    return { configured: false, students: 0, reports: 0, skipped: 0, weekLabel: label };
  }

  const recipients = await sendReports(schoolId, reports, parentsByStudent, label);
  return {
    configured: true,
    students: reports.length,
    reports: recipients,
    skipped,
    weekLabel: label,
  };
}
