import "server-only";

import { requireSchool } from "@/server/auth/dal";
import { withTenant } from "@/server/db/tenant";
import { toDateOnly } from "@/server/academics/attendance";

/**
 * Live figures for the dashboard tiles. One tenant transaction computes every
 * area's headline count (classes, students, open red flags, …) so each tile can
 * show a real number instead of static copy. School-wide counts, read at request
 * time (the dashboard is dynamic), so they always reflect the current data.
 *
 * Keyed by the nav item's `href` so the page can look a label up directly.
 * Areas without a meaningful single count (e.g. Settings) simply have no entry
 * and fall back to their static description.
 */
export type DashboardCounts = Record<string, string>;

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

export async function getDashboardCounts(): Promise<DashboardCounts> {
  const { user, schoolId } = await requireSchool();

  return withTenant(schoolId, async (tx) => {
    const today = toDateOnly(new Date());
    const weekAgo = toDateOnly(new Date(Date.now() - 6 * 24 * 60 * 60 * 1000));

    // Counts are cheap; run them sequentially to stay within one interactive
    // transaction (Prisma discourages parallel queries on a tx client).
    const classes = await tx.class.count();
    const subjects = await tx.subject.count();
    const students = await tx.student.count({ where: { isActive: true } });
    const teachers = await tx.user.count({ where: { role: "TEACHER", isActive: true } });
    const parents = await tx.user.count({ where: { role: "PARENT", isActive: true } });
    const markedToday = await tx.attendance.count({ where: { date: today } });
    const homeworkThisWeek = await tx.diaryEntry.count({ where: { date: { gte: weekAgo } } });
    const exams = await tx.exam.count();
    const openFlags = await tx.redFlag.count({ where: { status: "OPEN" } });
    const unpaidInvoices = await tx.invoice.count({
      where: { status: { in: ["UNPAID", "PARTIAL"] } },
    });
    const unread = await tx.notification.count({
      where: { recipientId: user.id, readAt: null },
    });

    return {
      "/classes": plural(classes, "class", "classes"),
      "/subjects": plural(subjects, "subject", "subjects"),
      "/students": plural(students, "student", "students"),
      "/teachers": plural(teachers, "teacher", "teachers"),
      "/parents": plural(parents, "parent", "parents"),
      "/attendance": `${markedToday} marked today`,
      "/homework": `${homeworkThisWeek} this week`,
      "/exams": plural(exams, "exam", "exams"),
      "/progress": plural(students, "student", "students"),
      "/red-flags": `${openFlags} open`,
      "/fees": `${unpaidInvoices} unpaid`,
      "/notifications": `${unread} unread`,
    };
  });
}
