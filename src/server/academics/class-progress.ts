import "server-only";

import type { ClassNoteType } from "@prisma/client";

import { requireRole, requireSchool } from "@/server/auth/dal";
import { withTenant } from "@/server/db/tenant";
import { toDateOnly } from "@/server/academics/attendance";
import { normalizeMonth, presentRate } from "@/lib/attendance";
import { percentage } from "@/lib/grades";

/**
 * Class progress (Module 7.4). The HEAD-facing counterpart to the student
 * roll-up: instead of one student's record, this compares every class across a
 * few headline parameters - average attendance, published-exam average, open
 * red flags, and the qualitative `ClassNote` log (head visits, general notes,
 * assembly activities, parent comments). HEAD-only; tenant-scoped via
 * `withTenant`. Attendance and note counts follow the selected month; the exam
 * average is all-time (exams aren't a monthly cadence).
 */

/** Half-open UTC range [start, end) for a "YYYY-MM" month. */
function monthRange(month: string): { start: Date; end: Date } {
  const [y, m] = month.split("-").map(Number);
  return { start: new Date(Date.UTC(y, m - 1, 1)), end: new Date(Date.UTC(y, m, 1)) };
}

/** A blank per-type tally. */
function emptyNoteCounts(): Record<ClassNoteType, number> {
  return { HEAD_VISIT: 0, GENERAL: 0, ASSEMBLY: 0, PARENT_COMMENT: 0 };
}

export type ClassProgressCard = {
  classId: string;
  name: string;
  students: number;
  /** Month present-rate (0-100), or null when nothing was marked. */
  presentRate: number | null;
  /** Days marked across the class this month (denominator context). */
  markedRecords: number;
  /** All-time published-exam average percentage (0-100), or null. */
  examAverage: number | null;
  openFlags: number;
  notes: Record<ClassNoteType, number>;
  noteTotal: number;
};

export type AllClassesProgress = {
  month: string;
  classes: ClassProgressCard[];
  totals: {
    classes: number;
    students: number;
    /** School-wide month present-rate across every class, or null. */
    presentRate: number | null;
    /** School-wide all-time published-exam average, or null. */
    examAverage: number | null;
    openFlags: number;
    notesThisMonth: number;
  };
};

/**
 * Every class with its progress parameters for `month` (HEAD-only). One tenant
 * transaction; queries run sequentially (Prisma discourages parallel queries on
 * an interactive transaction client).
 */
export async function getAllClassesProgress(input?: {
  month?: string;
}): Promise<AllClassesProgress> {
  await requireRole("HEAD");
  const { schoolId } = await requireSchool();
  const month = normalizeMonth(input?.month);
  const { start, end } = monthRange(month);

  return withTenant(schoolId, async (tx) => {
    const classes = await tx.class.findMany({
      orderBy: [{ level: "asc" }, { name: "asc" }],
      select: { id: true, name: true },
    });

    const studentGroups = await tx.student.groupBy({
      by: ["classId"],
      where: { isActive: true },
      _count: { _all: true },
    });
    const studentsByClass = new Map(studentGroups.map((g) => [g.classId, g._count._all]));

    // Attendance this month, tallied per class.
    const attendance = await tx.attendance.findMany({
      where: { date: { gte: start, lt: end } },
      select: { classId: true, status: true },
    });
    const presentByClass = new Map<string, number>();
    const markedByClass = new Map<string, number>();
    for (const a of attendance) {
      markedByClass.set(a.classId, (markedByClass.get(a.classId) ?? 0) + 1);
      if (a.status === "PRESENT") {
        presentByClass.set(a.classId, (presentByClass.get(a.classId) ?? 0) + 1);
      }
    }

    // Published-exam results, tallied per class as obtained/max (all-time).
    const results = await tx.examResult.findMany({
      where: {
        isAbsent: false,
        marksObtained: { not: null },
        examSubject: { exam: { isPublished: true } },
      },
      select: {
        marksObtained: true,
        examSubject: { select: { maxMarks: true, exam: { select: { classId: true } } } },
      },
    });
    const obtainedByClass = new Map<string, number>();
    const maxByClass = new Map<string, number>();
    for (const r of results) {
      const classId = r.examSubject.exam.classId;
      obtainedByClass.set(classId, (obtainedByClass.get(classId) ?? 0) + Number(r.marksObtained));
      maxByClass.set(classId, (maxByClass.get(classId) ?? 0) + Number(r.examSubject.maxMarks));
    }

    // Open red flags, counted per class via the student's class.
    const flags = await tx.redFlag.findMany({
      where: { status: "OPEN" },
      select: { student: { select: { classId: true } } },
    });
    const flagsByClass = new Map<string, number>();
    for (const f of flags) {
      const classId = f.student.classId;
      flagsByClass.set(classId, (flagsByClass.get(classId) ?? 0) + 1);
    }

    // Class notes this month, tallied per class per type.
    const notes = await tx.classNote.findMany({
      where: { date: { gte: start, lt: end } },
      select: { classId: true, type: true },
    });
    const notesByClass = new Map<string, Record<ClassNoteType, number>>();
    for (const n of notes) {
      const tally = notesByClass.get(n.classId) ?? emptyNoteCounts();
      tally[n.type] += 1;
      notesByClass.set(n.classId, tally);
    }

    const cards: ClassProgressCard[] = classes.map((c) => {
      const marked = markedByClass.get(c.id) ?? 0;
      const obtained = obtainedByClass.get(c.id) ?? 0;
      const max = maxByClass.get(c.id) ?? 0;
      const noteTally = notesByClass.get(c.id) ?? emptyNoteCounts();
      const noteTotal =
        noteTally.HEAD_VISIT + noteTally.GENERAL + noteTally.ASSEMBLY + noteTally.PARENT_COMMENT;
      return {
        classId: c.id,
        name: c.name,
        students: studentsByClass.get(c.id) ?? 0,
        presentRate: presentRate(presentByClass.get(c.id) ?? 0, marked),
        markedRecords: marked,
        examAverage: max > 0 ? percentage(obtained, max) : null,
        openFlags: flagsByClass.get(c.id) ?? 0,
        notes: noteTally,
        noteTotal,
      };
    });

    // School-wide roll-ups from the same per-class tallies.
    let totalPresent = 0;
    let totalMarked = 0;
    for (const v of presentByClass.values()) totalPresent += v;
    for (const v of markedByClass.values()) totalMarked += v;
    let totalObtained = 0;
    let totalMax = 0;
    for (const v of obtainedByClass.values()) totalObtained += v;
    for (const v of maxByClass.values()) totalMax += v;

    return {
      month,
      classes: cards,
      totals: {
        classes: cards.length,
        students: cards.reduce((sum, c) => sum + c.students, 0),
        presentRate: presentRate(totalPresent, totalMarked),
        examAverage: totalMax > 0 ? percentage(totalObtained, totalMax) : null,
        openFlags: flags.length,
        notesThisMonth: notes.length,
      },
    };
  });
}

export type ClassNoteRow = {
  id: string;
  classId: string;
  className: string;
  type: ClassNoteType;
  date: Date;
  title: string;
  body: string;
  authorName: string | null;
};

/** Recent class notes for the school, newest first, optionally one class only. */
export async function listClassNotes(input?: {
  classId?: string | null;
  take?: number;
}): Promise<ClassNoteRow[]> {
  await requireRole("HEAD");
  const { schoolId } = await requireSchool();
  return withTenant(schoolId, async (tx) => {
    const rows = await tx.classNote.findMany({
      where: input?.classId ? { classId: input.classId } : {},
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: input?.take ?? 50,
      select: {
        id: true,
        classId: true,
        type: true,
        date: true,
        title: true,
        body: true,
        class: { select: { name: true } },
        createdBy: { select: { name: true } },
      },
    });
    return rows.map((r) => ({
      id: r.id,
      classId: r.classId,
      className: r.class.name,
      type: r.type,
      date: r.date,
      title: r.title,
      body: r.body,
      authorName: r.createdBy?.name ?? null,
    }));
  });
}

export type ClassNoteInput = {
  classId: string;
  type: ClassNoteType;
  date: Date;
  title: string;
  body: string;
};

/**
 * Log a class note (HEAD). The class FK target is re-checked in-tenant (RLS
 * doesn't guard FK targets) before insert; the author is stamped from the
 * session, never the client. Returns the new note id.
 */
export async function addClassNote(input: ClassNoteInput): Promise<{ id: string }> {
  await requireRole("HEAD");
  const { user, schoolId } = await requireSchool();
  const date = toDateOnly(input.date);
  return withTenant(schoolId, async (tx) => {
    const cls = await tx.class.findUnique({ where: { id: input.classId }, select: { id: true } });
    if (!cls) throw new Error("Class not found");
    const note = await tx.classNote.create({
      data: {
        schoolId,
        classId: input.classId,
        type: input.type,
        date,
        title: input.title,
        body: input.body,
        createdById: user.id,
      },
      select: { id: true },
    });
    return { id: note.id };
  });
}

/** Delete a class note (HEAD). */
export async function deleteClassNote(id: string): Promise<void> {
  await requireRole("HEAD");
  const { schoolId } = await requireSchool();
  await withTenant(schoolId, (tx) => tx.classNote.deleteMany({ where: { id } }));
}
