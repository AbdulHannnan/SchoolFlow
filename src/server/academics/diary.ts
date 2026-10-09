import "server-only";

import type { DiaryType, Prisma } from "@prisma/client";
import type { Session } from "next-auth";

import { requireSchool } from "@/server/auth/dal";
import { withTenant } from "@/server/db/tenant";
import { toDateOnly } from "@/server/academics/attendance";
import { dispatch } from "@/server/notifications/dispatch";
import { formatDay } from "@/lib/attendance";

/**
 * Homework / Daily Diary (Module 5). A teacher or head posts an entry for a
 * class (optionally one section, optionally a subject); parents of the targeted
 * students then see it and get a HOMEWORK_POSTED notification. Tenant-scoped;
 * reads and writes use `withTenant` so RLS pins every row to the acting school.
 */

const CLASS_FEED_LIMIT = 50;
const PARENT_FEED_LIMIT = 20;

/**
 * A HEAD may post to any class; a TEACHER only to a class they're assigned to.
 * Runs inside the tenant context so the lookup can't see another school.
 */
async function assertCanPostToClass(
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

export type CreateDiaryInput = {
  classId: string;
  sectionId: string | null;
  subjectId: string | null;
  type: DiaryType;
  date: Date;
  title: string;
  content: string;
  dueDate: Date | null;
};

/**
 * Post a homework/diary entry, then fan a HOMEWORK_POSTED notification out to
 * the parents of the targeted students. The dispatch happens after the
 * transaction commits, so a rolled-back post never notifies anyone; channel
 * failures are isolated by the dispatcher. Returns the entry id and how many
 * parents were notified.
 */
export async function createDiaryEntry(input: CreateDiaryInput) {
  const { user, schoolId } = await requireSchool();
  const date = toDateOnly(input.date);
  const dueDate = input.dueDate ? toDateOnly(input.dueDate) : null;

  const result = await withTenant(schoolId, async (tx) => {
    const cls = await tx.class.findUnique({
      where: { id: input.classId },
      select: { id: true, name: true },
    });
    if (!cls) throw new Error("Class not found");
    await assertCanPostToClass(tx, user, input.classId);

    // Re-check FK targets in-tenant (RLS doesn't guard FK targets): the section
    // must belong to this class, the subject to this school.
    if (input.sectionId) {
      const section = await tx.section.findFirst({
        where: { id: input.sectionId, classId: input.classId },
        select: { id: true },
      });
      if (!section) throw new Error("That section does not belong to the selected class");
    }
    let subjectName: string | null = null;
    if (input.subjectId) {
      const subject = await tx.subject.findUnique({
        where: { id: input.subjectId },
        select: { name: true },
      });
      if (!subject) throw new Error("Subject not found");
      subjectName = subject.name;
    }

    const entry = await tx.diaryEntry.create({
      data: {
        schoolId,
        classId: input.classId,
        sectionId: input.sectionId,
        subjectId: input.subjectId,
        type: input.type,
        date,
        title: input.title,
        content: input.content,
        dueDate,
        createdById: user.id,
      },
      select: { id: true },
    });

    // Recipients: parents of the active students the entry targets.
    const students = await tx.student.findMany({
      where: {
        classId: input.classId,
        ...(input.sectionId ? { sectionId: input.sectionId } : {}),
        isActive: true,
      },
      select: { id: true },
    });
    const parentIds =
      students.length === 0
        ? []
        : [
            ...new Set(
              (
                await tx.parentStudent.findMany({
                  where: { studentId: { in: students.map((s) => s.id) } },
                  select: { parentId: true },
                })
              ).map((l) => l.parentId),
            ),
          ];

    return {
      entryId: entry.id,
      className: cls.name,
      subjectName,
      parentIds,
      dueDate,
    };
  });

  if (result.parentIds.length > 0) {
    await dispatch({
      type: "HOMEWORK_POSTED",
      schoolId,
      recipientIds: result.parentIds,
      diaryId: result.entryId,
      diaryType: input.type,
      className: result.className,
      subjectName: result.subjectName,
      entryTitle: input.title,
      dueDate: result.dueDate ? formatDay(result.dueDate) : null,
      channels: ["in-app"],
    });
  }

  return { id: result.entryId, notified: result.parentIds.length };
}

export type DiaryListEntry = {
  id: string;
  type: DiaryType;
  date: Date;
  dueDate: Date | null;
  title: string;
  content: string;
  subject: { name: string } | null;
  section: { name: string } | null;
  createdBy: { name: string } | null;
};

/**
 * Entries for one class, newest first (teacher/head view). When a section is
 * chosen, section-specific entries for it plus whole-class entries are shown.
 */
export async function listClassDiary(input: { classId: string; sectionId: string | null }) {
  const { user, schoolId } = await requireSchool();
  return withTenant(schoolId, async (tx) => {
    const cls = await tx.class.findUnique({
      where: { id: input.classId },
      select: { id: true, name: true },
    });
    if (!cls) throw new Error("Class not found");
    await assertCanPostToClass(tx, user, input.classId);

    const entries = await tx.diaryEntry.findMany({
      where: {
        classId: input.classId,
        ...(input.sectionId ? { OR: [{ sectionId: input.sectionId }, { sectionId: null }] } : {}),
      },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: CLASS_FEED_LIMIT,
      select: {
        id: true,
        type: true,
        date: true,
        dueDate: true,
        title: true,
        content: true,
        subject: { select: { name: true } },
        section: { select: { name: true } },
        createdBy: { select: { name: true } },
      },
    });

    return { class: cls, entries };
  });
}

/**
 * Delete an entry. A HEAD may delete any; a TEACHER only their own posts. The
 * delete is scoped so a teacher can never remove another's entry even with a
 * valid id.
 */
export async function deleteDiaryEntry(id: string): Promise<void> {
  const { user, schoolId } = await requireSchool();
  await withTenant(schoolId, (tx) =>
    tx.diaryEntry.deleteMany({
      where: { id, ...(user.role === "TEACHER" ? { createdById: user.id } : {}) },
    }),
  );
}

/** The signed-in parent's children, each with their class's recent entries. */
export async function listChildrenDiary() {
  const { user, schoolId } = await requireSchool();
  return withTenant(schoolId, async (tx) => {
    const links = await tx.parentStudent.findMany({
      where: { parentId: user.id },
      orderBy: { createdAt: "asc" },
      select: {
        student: {
          select: {
            id: true,
            name: true,
            classId: true,
            sectionId: true,
            class: { select: { name: true } },
            section: { select: { name: true } },
          },
        },
      },
    });

    const children = [];
    for (const { student } of links) {
      const entries = await tx.diaryEntry.findMany({
        where: {
          classId: student.classId,
          // Whole-class entries, plus ones aimed at this child's section.
          OR: [
            { sectionId: null },
            ...(student.sectionId ? [{ sectionId: student.sectionId }] : []),
          ],
        },
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
        take: PARENT_FEED_LIMIT,
        select: {
          id: true,
          type: true,
          date: true,
          dueDate: true,
          title: true,
          content: true,
          subject: { select: { name: true } },
          section: { select: { name: true } },
          createdBy: { select: { name: true } },
        },
      });
      children.push({ student, entries });
    }

    return { children };
  });
}
