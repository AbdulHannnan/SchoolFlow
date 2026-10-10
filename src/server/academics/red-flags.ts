import "server-only";

import type { RedFlagType } from "@prisma/client";

import { requireSchool } from "@/server/auth/dal";
import { withTenant } from "@/server/db/tenant";
import { dispatch } from "@/server/notifications/dispatch";
import { monthLabel, normalizeMonth } from "@/lib/attendance";
import { percentage } from "@/lib/grades";

/**
 * Red flags (Module 7.3): at-risk indicators raised when a rule crosses a
 * threshold. A HEAD triggers a scan (optionally scoped to a class and month);
 * each rule produces a `RedFlag` keyed so re-scanning refreshes rather than
 * duplicates, and every newly-raised flag fans a RED_FLAG alert out to the
 * school's HEADs over the in-app channel. Tenant-scoped; reads and writes use
 * `withTenant` so RLS pins every row to the acting school.
 *
 * Thresholds are fixed here for now; per-school configuration can come later.
 */

/** Absences in a single month at or above which an attendance flag is raised. */
const ABSENCE_LIMIT = 4;
/** Failed subjects in one exam at or above which a grades flag is raised. */
const FAIL_SUBJECT_LIMIT = 2;
/** Overall exam percentage below which a grades flag is raised. */
const LOW_OVERALL_PERCENT = 40;

/** Half-open UTC range [start, end) for a "YYYY-MM" month. */
function monthRange(month: string): { start: Date; end: Date } {
  const [y, m] = month.split("-").map(Number);
  return { start: new Date(Date.UTC(y, m - 1, 1)), end: new Date(Date.UTC(y, m, 1)) };
}

type DesiredFlag = {
  studentId: string;
  studentName: string;
  type: RedFlagType;
  key: string;
  title: string;
  detail: string;
  reason: string;
};

export type ScanResult = {
  /** Flags newly raised by this scan (not previously present). */
  raised: number;
  /** Flags that already existed and were refreshed in place. */
  refreshed: number;
  /** HEADs alerted per new flag (0 when nothing new was raised). */
  notified: number;
  month: string;
};

/**
 * Evaluate the attendance and grade rules for the chosen scope and upsert the
 * resulting red flags. Returns how many were newly raised vs. refreshed, and
 * how many HEADs were alerted.
 */
export async function scanRedFlags(input?: {
  classId?: string | null;
  month?: string | null;
}): Promise<ScanResult> {
  const { schoolId } = await requireSchool();
  const month = normalizeMonth(input?.month ?? undefined);
  const classId = input?.classId || null;

  const { newFlags, refreshed, headIds } = await withTenant(schoolId, async (tx) => {
    const students = await tx.student.findMany({
      where: { isActive: true, ...(classId ? { classId } : {}) },
      select: { id: true, name: true },
    });
    const nameById = new Map(students.map((s) => [s.id, s.name]));
    const desired: DesiredFlag[] = [];

    // --- Rule 1: too many absences in the month ---------------------------
    if (students.length > 0) {
      const { start, end } = monthRange(month);
      const absents = await tx.attendance.findMany({
        where: {
          status: "ABSENT",
          date: { gte: start, lt: end },
          studentId: { in: students.map((s) => s.id) },
        },
        select: { studentId: true },
      });
      const countByStudent = new Map<string, number>();
      for (const a of absents) {
        countByStudent.set(a.studentId, (countByStudent.get(a.studentId) ?? 0) + 1);
      }
      for (const [studentId, count] of countByStudent) {
        if (count < ABSENCE_LIMIT) continue;
        const reason = `${count} ${count === 1 ? "absence" : "absences"} in ${monthLabel(month)}`;
        desired.push({
          studentId,
          studentName: nameById.get(studentId) ?? "Student",
          type: "ATTENDANCE_LOW",
          key: `ATTENDANCE_LOW:${month}`,
          title: "Low attendance",
          detail: reason,
          reason,
        });
      }
    }

    // --- Rule 2: weak results in a published exam -------------------------
    const exams = await tx.exam.findMany({
      where: { isPublished: true, ...(classId ? { classId } : {}) },
      select: {
        id: true,
        name: true,
        subjects: { select: { id: true, maxMarks: true, passMarks: true } },
      },
    });
    for (const exam of exams) {
      if (exam.subjects.length === 0) continue;
      const subjById = new Map(exam.subjects.map((s) => [s.id, s]));
      const results = await tx.examResult.findMany({
        where: { examSubjectId: { in: exam.subjects.map((s) => s.id) } },
        select: { examSubjectId: true, studentId: true, marksObtained: true, isAbsent: true },
      });

      const agg = new Map<
        string,
        { failed: number; obtained: number; max: number; any: boolean }
      >();
      for (const r of results) {
        const subj = subjById.get(r.examSubjectId);
        if (!subj || !nameById.has(r.studentId)) continue;
        const cur = agg.get(r.studentId) ?? { failed: 0, obtained: 0, max: 0, any: false };
        const pass = subj.passMarks !== null ? Number(subj.passMarks) : null;
        if (r.isAbsent) {
          if (pass !== null) cur.failed += 1;
        } else if (r.marksObtained !== null) {
          const m = Number(r.marksObtained);
          cur.obtained += m;
          cur.max += Number(subj.maxMarks);
          cur.any = true;
          if (pass !== null && m < pass) cur.failed += 1;
        }
        agg.set(r.studentId, cur);
      }

      for (const [studentId, a] of agg) {
        const overall = a.any ? percentage(a.obtained, a.max) : null;
        const lowOverall = overall !== null && overall < LOW_OVERALL_PERCENT;
        if (a.failed < FAIL_SUBJECT_LIMIT && !lowOverall) continue;
        const bits: string[] = [];
        if (a.failed > 0)
          bits.push(`failed ${a.failed} ${a.failed === 1 ? "subject" : "subjects"}`);
        if (overall !== null) bits.push(`${overall}% overall`);
        const reason = `${exam.name}: ${bits.join(", ")}`;
        desired.push({
          studentId,
          studentName: nameById.get(studentId)!,
          type: "GRADES_LOW",
          key: `EXAM_RESULT:${exam.id}`,
          title: "Weak exam results",
          detail: reason,
          reason,
        });
      }
    }

    if (desired.length === 0) {
      return { newFlags: [] as DesiredFlag[], refreshed: 0, headIds: [] as string[] };
    }

    // Which desired flags already exist? Those are refreshed; the rest are new.
    const existing = await tx.redFlag.findMany({
      where: { OR: desired.map((d) => ({ studentId: d.studentId, key: d.key })) },
      select: { studentId: true, key: true },
    });
    const existingKeys = new Set(existing.map((e) => `${e.studentId}|${e.key}`));

    for (const d of desired) {
      await tx.redFlag.upsert({
        where: { studentId_key: { studentId: d.studentId, key: d.key } },
        create: {
          schoolId,
          studentId: d.studentId,
          type: d.type,
          key: d.key,
          title: d.title,
          detail: d.detail,
        },
        update: { type: d.type, title: d.title, detail: d.detail },
      });
    }

    const newFlags = desired.filter((d) => !existingKeys.has(`${d.studentId}|${d.key}`));
    const heads =
      newFlags.length > 0
        ? await tx.user.findMany({ where: { role: "HEAD", isActive: true }, select: { id: true } })
        : [];

    return {
      newFlags,
      refreshed: desired.length - newFlags.length,
      headIds: heads.map((h) => h.id),
    };
  });

  // Alert HEADs for each newly-raised flag, after the transaction commits.
  if (headIds.length > 0) {
    for (const f of newFlags) {
      await dispatch({
        type: "RED_FLAG",
        schoolId,
        recipientIds: headIds,
        studentId: f.studentId,
        studentName: f.studentName,
        reason: f.reason,
        channels: ["in-app"],
      });
    }
  }

  return {
    raised: newFlags.length,
    refreshed,
    notified: newFlags.length > 0 ? headIds.length : 0,
    month,
  };
}

export type RedFlagRow = {
  id: string;
  type: RedFlagType;
  title: string;
  detail: string;
  status: "OPEN" | "RESOLVED";
  createdAt: Date;
  resolvedAt: Date | null;
  student: {
    id: string;
    name: string;
    rollNumber: string | null;
    class: { name: string } | null;
    section: { name: string } | null;
  };
};

/** Red flags for the school (HEAD), open first then newest. */
export async function listRedFlags(input?: {
  status?: "OPEN" | "RESOLVED";
}): Promise<RedFlagRow[]> {
  const { schoolId } = await requireSchool();
  return withTenant(schoolId, (tx) =>
    tx.redFlag.findMany({
      where: input?.status ? { status: input.status } : {},
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      select: {
        id: true,
        type: true,
        title: true,
        detail: true,
        status: true,
        createdAt: true,
        resolvedAt: true,
        student: {
          select: {
            id: true,
            name: true,
            rollNumber: true,
            class: { select: { name: true } },
            section: { select: { name: true } },
          },
        },
      },
    }),
  );
}

/** Mark a flag resolved (HEAD acted on it). */
export async function resolveRedFlag(id: string): Promise<void> {
  const { user, schoolId } = await requireSchool();
  await withTenant(schoolId, (tx) =>
    tx.redFlag.updateMany({
      where: { id },
      data: { status: "RESOLVED", resolvedById: user.id, resolvedAt: new Date() },
    }),
  );
}

/** Reopen a previously resolved flag. */
export async function reopenRedFlag(id: string): Promise<void> {
  const { schoolId } = await requireSchool();
  await withTenant(schoolId, (tx) =>
    tx.redFlag.updateMany({
      where: { id },
      data: { status: "OPEN", resolvedById: null, resolvedAt: null },
    }),
  );
}
