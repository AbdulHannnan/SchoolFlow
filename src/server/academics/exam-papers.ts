import "server-only";

import type { ExamPaperStatus, Prisma } from "@prisma/client";
import type { Session } from "next-auth";

import { requireSchool } from "@/server/auth/dal";
import { withTenant } from "@/server/db/tenant";
import { toDateOnly } from "@/server/academics/attendance";

/**
 * Exam papers (Module 7). A TEACHER submits a question paper - an external link
 * (Drive/OneDrive) plus class, subject and exam date - ahead of the exam, for a
 * HEAD to review. Review is a short loop: SUBMITTED -> APPROVED or
 * CHANGES_REQUESTED (with an optional note the teacher reads); a teacher may
 * revise and re-submit until it's approved. Standalone from the Exam/marks
 * tables. Tenant-scoped: every read/write runs inside `withTenant` so RLS pins
 * each row to the acting school.
 */

/** A TEACHER may submit only for a class they're assigned to; HEAD any. */
async function assertCanSubmitForClass(
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
  throw new Error("Not allowed to submit exam papers");
}

export type ExamPaperInput = {
  classId: string;
  subjectId: string;
  title: string;
  examDate: Date;
  fileUrl: string;
  notes: string | null;
};

/**
 * Submit a new exam paper (TEACHER / HEAD). The class and subject FK targets are
 * re-checked in-tenant (RLS doesn't guard FK targets), and a teacher must be
 * assigned to the class. Returns the new paper id.
 */
export async function submitExamPaper(input: ExamPaperInput) {
  const { user, schoolId } = await requireSchool();
  const examDate = toDateOnly(input.examDate);

  return withTenant(schoolId, async (tx) => {
    const cls = await tx.class.findUnique({ where: { id: input.classId }, select: { id: true } });
    if (!cls) throw new Error("Class not found");
    await assertCanSubmitForClass(tx, user, input.classId);

    const subject = await tx.subject.findUnique({
      where: { id: input.subjectId },
      select: { id: true },
    });
    if (!subject) throw new Error("Subject not found");

    const paper = await tx.examPaper.create({
      data: {
        schoolId,
        teacherId: user.id,
        classId: input.classId,
        subjectId: input.subjectId,
        title: input.title,
        examDate,
        fileUrl: input.fileUrl,
        notes: input.notes,
      },
      select: { id: true },
    });
    return { id: paper.id };
  });
}

/**
 * Revise one of the teacher's own papers and re-submit it (status back to
 * SUBMITTED, review note cleared). Scoped to the owner, so a teacher can't edit
 * another's paper even with a valid id. An approved paper can't be re-edited.
 */
export async function updateMyExamPaper(input: ExamPaperInput & { id: string }) {
  const { user, schoolId } = await requireSchool();
  const examDate = toDateOnly(input.examDate);

  return withTenant(schoolId, async (tx) => {
    const paper = await tx.examPaper.findFirst({
      where: { id: input.id, teacherId: user.id },
      select: { status: true },
    });
    if (!paper) throw new Error("Paper not found");
    if (paper.status === "APPROVED") throw new Error("An approved paper can't be edited");

    const subject = await tx.subject.findUnique({
      where: { id: input.subjectId },
      select: { id: true },
    });
    if (!subject) throw new Error("Subject not found");
    const cls = await tx.class.findUnique({ where: { id: input.classId }, select: { id: true } });
    if (!cls) throw new Error("Class not found");
    await assertCanSubmitForClass(tx, user, input.classId);

    await tx.examPaper.updateMany({
      where: { id: input.id, teacherId: user.id },
      data: {
        classId: input.classId,
        subjectId: input.subjectId,
        title: input.title,
        examDate,
        fileUrl: input.fileUrl,
        notes: input.notes,
        status: "SUBMITTED",
        reviewNote: null,
        reviewedById: null,
        reviewedAt: null,
      },
    });
    return { id: input.id };
  });
}

export type ExamPaperRow = {
  id: string;
  title: string;
  classId: string;
  className: string;
  subjectId: string;
  subjectName: string;
  teacherName: string;
  examDate: Date;
  fileUrl: string;
  notes: string | null;
  status: ExamPaperStatus;
  reviewNote: string | null;
  reviewedAt: Date | null;
};

const PAPER_SELECT = {
  id: true,
  title: true,
  classId: true,
  subjectId: true,
  examDate: true,
  fileUrl: true,
  notes: true,
  status: true,
  reviewNote: true,
  reviewedAt: true,
  class: { select: { name: true } },
  subject: { select: { name: true } },
  teacher: { select: { name: true } },
} satisfies Prisma.ExamPaperSelect;

function toRow(p: {
  id: string;
  title: string;
  classId: string;
  subjectId: string;
  examDate: Date;
  fileUrl: string;
  notes: string | null;
  status: ExamPaperStatus;
  reviewNote: string | null;
  reviewedAt: Date | null;
  class: { name: string };
  subject: { name: string };
  teacher: { name: string };
}): ExamPaperRow {
  return {
    id: p.id,
    title: p.title,
    classId: p.classId,
    className: p.class.name,
    subjectId: p.subjectId,
    subjectName: p.subject.name,
    teacherName: p.teacher.name,
    examDate: p.examDate,
    fileUrl: p.fileUrl,
    notes: p.notes,
    status: p.status,
    reviewNote: p.reviewNote,
    reviewedAt: p.reviewedAt,
  };
}

/** The signed-in teacher's own submitted papers, newest exam date first. */
export async function listMyExamPapers(): Promise<ExamPaperRow[]> {
  const { user, schoolId } = await requireSchool();
  return withTenant(schoolId, async (tx) => {
    const rows = await tx.examPaper.findMany({
      where: { teacherId: user.id },
      orderBy: [{ examDate: "desc" }, { createdAt: "desc" }],
      select: PAPER_SELECT,
    });
    return rows.map(toRow);
  });
}

/**
 * All submitted papers for a HEAD to review, newest exam date first, optionally
 * filtered by class and/or status.
 */
export async function listExamPapersForReview(filter?: {
  classId?: string | null;
  status?: ExamPaperStatus | null;
}): Promise<ExamPaperRow[]> {
  const { schoolId } = await requireSchool();
  return withTenant(schoolId, async (tx) => {
    const rows = await tx.examPaper.findMany({
      where: {
        ...(filter?.classId ? { classId: filter.classId } : {}),
        ...(filter?.status ? { status: filter.status } : {}),
      },
      orderBy: [{ examDate: "desc" }, { createdAt: "desc" }],
      take: 200,
      select: PAPER_SELECT,
    });
    return rows.map(toRow);
  });
}

/** Counts of papers by status, for the HEAD's Papers block tile. */
export async function countExamPapersByStatus(): Promise<{
  submitted: number;
  approved: number;
  changesRequested: number;
}> {
  const { schoolId } = await requireSchool();
  return withTenant(schoolId, async (tx) => {
    const grouped = await tx.examPaper.groupBy({ by: ["status"], _count: { _all: true } });
    const by = new Map(grouped.map((g) => [g.status, g._count._all]));
    return {
      submitted: by.get("SUBMITTED") ?? 0,
      approved: by.get("APPROVED") ?? 0,
      changesRequested: by.get("CHANGES_REQUESTED") ?? 0,
    };
  });
}

/**
 * Record a HEAD's review decision on a paper: APPROVED or CHANGES_REQUESTED,
 * with an optional note the teacher sees. Stamps the reviewer and time.
 */
export async function reviewExamPaper(
  id: string,
  decision: "APPROVED" | "CHANGES_REQUESTED",
  note: string | null,
): Promise<void> {
  const { user, schoolId } = await requireSchool();
  await withTenant(schoolId, (tx) =>
    tx.examPaper.updateMany({
      where: { id },
      data: {
        status: decision,
        reviewNote: note,
        reviewedById: user.id,
        reviewedAt: new Date(),
      },
    }),
  );
}

/** Delete a paper. A HEAD may delete any; a TEACHER only their own. */
export async function deleteExamPaper(id: string): Promise<void> {
  const { user, schoolId } = await requireSchool();
  await withTenant(schoolId, (tx) =>
    tx.examPaper.deleteMany({
      where: { id, ...(user.role === "TEACHER" ? { teacherId: user.id } : {}) },
    }),
  );
}
