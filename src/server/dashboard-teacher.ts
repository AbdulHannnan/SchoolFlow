import "server-only";

import { requireRole, requireSchool } from "@/server/auth/dal";
import { withTenant } from "@/server/db/tenant";
import { toDateOnly, listMarkableClasses } from "@/server/academics/attendance";
import { listMyPlanner } from "@/server/academics/planner";
import { listMyMeetings, type MyMeetingItem } from "@/server/academics/meetings";

/**
 * The signed-in teacher's own overview (Module 9.2). Composes the teacher-scoped
 * reads that already enforce ownership (their markable classes, their planner,
 * their meeting invites) and adds one query for which of those classes have had
 * attendance marked today - the teacher's main daily action.
 *
 * Read at request time behind a <Suspense> boundary, like the rest of the DAL.
 */

type PlannerEntries = Awaited<ReturnType<typeof listMyPlanner>>;

export type TeacherClassStatus = {
  id: string;
  name: string;
  markedToday: boolean;
};

export type TeacherDashboard = {
  classes: TeacherClassStatus[];
  /** How many of the teacher's classes have attendance marked for today. */
  attendance: { marked: number; total: number };
  planner: {
    weekTotal: number;
    pending: number;
    completed: number;
    recent: PlannerEntries;
  };
  meetings: {
    upcomingCount: number;
    upcoming: MyMeetingItem[];
  };
};

/** The Monday-Sunday range (UTC day boundaries) containing `now`. */
function weekRange(now: Date): { monday: Date; sunday: Date } {
  const DAY = 24 * 60 * 60 * 1000;
  const today = toDateOnly(now);
  const mondayOffset = (today.getUTCDay() + 6) % 7; // days since Monday (Mon=0)
  const monday = new Date(today.getTime() - mondayOffset * DAY);
  const sunday = new Date(monday.getTime() + 6 * DAY);
  return { monday, sunday };
}

export async function getTeacherDashboard(): Promise<TeacherDashboard> {
  await requireRole("TEACHER");
  const { schoolId } = await requireSchool();

  const classes = await listMarkableClasses();
  const classIds = classes.map((c) => c.id);

  // Which of the teacher's classes already have attendance marked today.
  const markedClassIds = await withTenant(schoolId, async (tx) => {
    if (classIds.length === 0) return new Set<string>();
    const rows = await tx.attendance.findMany({
      where: { date: toDateOnly(new Date()), classId: { in: classIds } },
      distinct: ["classId"],
      select: { classId: true },
    });
    return new Set(rows.map((r) => r.classId));
  });

  const classStatuses: TeacherClassStatus[] = classes.map((c) => ({
    id: c.id,
    name: c.name,
    markedToday: markedClassIds.has(c.id),
  }));

  const { monday, sunday } = weekRange(new Date());
  const weekPlans = await listMyPlanner({ from: monday, to: sunday });

  const meetings = await listMyMeetings();
  const now = Date.now();
  const upcoming = meetings
    .filter((m) => m.scheduledAt.getTime() >= now)
    .sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());

  return {
    classes: classStatuses,
    attendance: {
      marked: classStatuses.filter((c) => c.markedToday).length,
      total: classStatuses.length,
    },
    planner: {
      weekTotal: weekPlans.length,
      pending: weekPlans.filter((p) => p.status === "PLANNED").length,
      completed: weekPlans.filter((p) => p.status === "COMPLETED").length,
      recent: weekPlans.slice(0, 5),
    },
    meetings: {
      upcomingCount: upcoming.length,
      upcoming: upcoming.slice(0, 5),
    },
  };
}
