import "server-only";

import type { Prisma, PlannerStatus } from "@prisma/client";
import type { Session } from "next-auth";

import { requireSchool } from "@/server/auth/dal";
import { withTenant } from "@/server/db/tenant";
import { toDateOnly } from "@/server/academics/attendance";

/**
 * Planner register (Module 8.2). A teacher records their lesson plan for a
 * class + subject on a date (topic, plan details, planned homework) and marks it
 * taught. The register is an internal staff record: the owning teacher writes
 * their own plans, and a HEAD reviews everyone's. Unlike the Module 5 diary it
 * is never pushed to parents. Tenant-scoped; every read and write runs inside
 * `withTenant` so RLS pins each row to the acting school.
 */

const REGISTER_LIMIT = 200;

/**
 * A TEACHER may plan only for a class they're assigned to. Runs inside the
 * tenant context so the assignment lookup can't see another school.
 */
async function assertCanPlanClass(
  tx: Prisma.TransactionClient,
  user: Session["user"],
  classId: string,
): Promise<void> {
  const assignment = await tx.teacherAssignment.findFirst({
    where: { teacherId: user.id, classId },
    select: { id: true },
  });
  if (!assignment) throw new Error("You are not assigned to this class");
}

export type CreatePlannerInput = {
  classId: string;
  subjectId: string;
  date: Date;
  topic: string;
  details: string;
  homework: string | null;
};

/**
 * Create or update (the teacher's own) lesson plan for a class + subject on a
 * date. Idempotent via the `(teacherId, classId, subjectId, date)` unique key -
 * re-saving the same slot edits the plan rather than duplicating. FK targets are
 * re-checked in-tenant (RLS doesn't guard them): the class must be one the
 * teacher is assigned to, and the subject must resolve in this school. Editing
 * the plan leaves its taught/`status` untouched. TEACHER only (the owner).
 */
export async function createPlannerEntry(input: CreatePlannerInput) {
  const { user, schoolId } = await requireSchool();
  const date = toDateOnly(input.date);
  const homework = input.homework?.trim() ? input.homework.trim() : null;

  return withTenant(schoolId, async (tx) => {
    const cls = await tx.class.findUnique({ where: { id: input.classId }, select: { id: true } });
    if (!cls) throw new Error("Class not found");
    await assertCanPlanClass(tx, user, input.classId);

    const subject = await tx.subject.findUnique({
      where: { id: input.subjectId },
      select: { id: true },
    });
    if (!subject) throw new Error("Subject not found");

    const entry = await tx.plannerEntry.upsert({
      where: {
        teacherId_classId_subjectId_date: {
          teacherId: user.id,
          classId: input.classId,
          subjectId: input.subjectId,
          date,
        },
      },
      create: {
        schoolId,
        teacherId: user.id,
        classId: input.classId,
        subjectId: input.subjectId,
        date,
        topic: input.topic,
        details: input.details,
        homework,
      },
      update: { topic: input.topic, details: input.details, homework },
      select: { id: true },
    });

    return { id: entry.id };
  });
}

export type PlannerListEntry = {
  id: string;
  date: Date;
  topic: string;
  details: string;
  homework: string | null;
  status: PlannerStatus;
  class: { name: string };
  subject: { name: string };
  teacher: { name: string };
};

/** Half-open day range [from, to+1day) covering the inclusive `from..to` days. */
function dayRange(from: Date, to: Date): { start: Date; end: Date } {
  const start = toDateOnly(from);
  const end = new Date(toDateOnly(to).getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

/** The signed-in teacher's own plans over an inclusive date range, newest first. */
export async function listMyPlanner(input: { from: Date; to: Date }) {
  const { user, schoolId } = await requireSchool();
  const { start, end } = dayRange(input.from, input.to);
  return withTenant(schoolId, (tx) =>
    tx.plannerEntry.findMany({
      where: { teacherId: user.id, date: { gte: start, lt: end } },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: REGISTER_LIMIT,
      select: {
        id: true,
        date: true,
        topic: true,
        details: true,
        homework: true,
        status: true,
        class: { select: { name: true } },
        subject: { select: { name: true } },
        teacher: { select: { name: true } },
      },
    }),
  );
}

/**
 * The planner register for a HEAD to review: every teacher's plans over an
 * inclusive date range, optionally filtered to one teacher, newest first.
 */
export async function listPlannerRegister(input: {
  teacherId: string | null;
  from: Date;
  to: Date;
}) {
  const { schoolId } = await requireSchool();
  const { start, end } = dayRange(input.from, input.to);
  return withTenant(schoolId, (tx) =>
    tx.plannerEntry.findMany({
      where: {
        date: { gte: start, lt: end },
        ...(input.teacherId ? { teacherId: input.teacherId } : {}),
      },
      orderBy: [{ date: "desc" }, { teacher: { name: "asc" } }, { createdAt: "desc" }],
      take: REGISTER_LIMIT,
      select: {
        id: true,
        date: true,
        topic: true,
        details: true,
        homework: true,
        status: true,
        class: { select: { name: true } },
        subject: { select: { name: true } },
        teacher: { select: { name: true } },
      },
    }),
  );
}

/**
 * Mark one of the teacher's own plans PLANNED/COMPLETED. The update is scoped to
 * the owner, so a teacher can never change another's entry even with a valid id.
 */
export async function setPlannerStatus(id: string, status: PlannerStatus): Promise<void> {
  const { user, schoolId } = await requireSchool();
  await withTenant(schoolId, (tx) =>
    tx.plannerEntry.updateMany({ where: { id, teacherId: user.id }, data: { status } }),
  );
}

/**
 * Delete a plan. A HEAD may delete any; a TEACHER only their own. The delete is
 * scoped so a teacher can never remove another's entry even with a valid id.
 */
export async function deletePlannerEntry(id: string): Promise<void> {
  const { user, schoolId } = await requireSchool();
  await withTenant(schoolId, (tx) =>
    tx.plannerEntry.deleteMany({
      where: { id, ...(user.role === "TEACHER" ? { teacherId: user.id } : {}) },
    }),
  );
}
