import "server-only";

import type { AttendanceStatus } from "@prisma/client";

import { requireRole, requireSchool } from "@/server/auth/dal";
import { withTenant } from "@/server/db/tenant";
import { toDateOnly } from "@/server/academics/attendance";
import { listRedFlags, type RedFlagRow } from "@/server/academics/red-flags";
import { currentMonth } from "@/lib/attendance";

/**
 * The HEAD's school-wide overview (Module 9.1). One tenant transaction computes
 * every headline figure a head needs at a glance - today's student and staff
 * attendance, this month's fee collection, outstanding dues and open red flags -
 * so the dashboard shows live numbers rather than static copy.
 *
 * Read at request time (the dashboard is dynamic), so it always reflects current
 * data; it is called from inside a <Suspense> boundary, like the rest of the DAL.
 * Queries run sequentially to stay within one interactive transaction (Prisma
 * discourages parallel queries on a tx client).
 */

/** A count of attendance outcomes plus the number of records that produced them. */
export type AttendanceBreakdown = {
  PRESENT: number;
  ABSENT: number;
  LATE: number;
  LEAVE: number;
  total: number;
};

export type HeadDashboard = {
  /** Headline entity counts for the school. */
  counts: {
    students: number;
    teachers: number;
    classes: number;
    parents: number;
  };
  /** Student attendance marked for today, plus class coverage. */
  attendanceToday: {
    breakdown: AttendanceBreakdown;
    classesMarked: number;
    totalClasses: number;
  };
  /** Staff attendance marked for today. */
  staffToday: {
    breakdown: AttendanceBreakdown;
    totalStaff: number;
  };
  /** Fees for the current billing month and overall dues. */
  fees: {
    period: string;
    billedThisMonth: number;
    collectedThisMonth: number;
    /** Dues across every open (unpaid/partial) invoice, any period. */
    outstandingTotal: number;
    outstandingInvoices: number;
    /** Parent-submitted payments awaiting a head's verification. */
    pendingPayments: number;
  };
  /** Open red flags: the count plus the five most recent. */
  redFlags: {
    open: number;
    recent: RedFlagRow[];
  };
};

const EMPTY_BREAKDOWN: AttendanceBreakdown = {
  PRESENT: 0,
  ABSENT: 0,
  LATE: 0,
  LEAVE: 0,
  total: 0,
};

/** Fold a `groupBy(status)` result into a flat breakdown with a total. */
function toBreakdown(
  groups: { status: AttendanceStatus; _count: { _all: number } }[],
): AttendanceBreakdown {
  const result: AttendanceBreakdown = { ...EMPTY_BREAKDOWN };
  for (const g of groups) {
    result[g.status] = g._count._all;
    result.total += g._count._all;
  }
  return result;
}

/** Decimal | null -> number (0 for null), for summing money safely. */
function num(value: { toString(): string } | null): number {
  return value == null ? 0 : Number(value.toString());
}

export async function getHeadDashboard(): Promise<HeadDashboard> {
  await requireRole("HEAD");
  const { schoolId } = await requireSchool();
  const period = currentMonth();

  const data = await withTenant(schoolId, async (tx) => {
    const today = toDateOnly(new Date());

    const students = await tx.student.count({ where: { isActive: true } });
    const teachers = await tx.user.count({ where: { role: "TEACHER", isActive: true } });
    const parents = await tx.user.count({ where: { role: "PARENT", isActive: true } });
    const totalClasses = await tx.class.count();

    const attendanceGroups = await tx.attendance.groupBy({
      by: ["status"],
      where: { date: today },
      _count: { _all: true },
    });
    const markedClasses = await tx.attendance.findMany({
      where: { date: today },
      distinct: ["classId"],
      select: { classId: true },
    });

    const staffGroups = await tx.staffAttendance.groupBy({
      by: ["status"],
      where: { date: today },
      _count: { _all: true },
    });

    const billed = await tx.invoice.aggregate({
      where: { period, status: { not: "CANCELLED" } },
      _sum: { total: true, paidAmount: true },
    });
    const outstanding = await tx.invoice.aggregate({
      where: { status: { in: ["UNPAID", "PARTIAL"] } },
      _sum: { total: true, paidAmount: true },
      _count: { _all: true },
    });
    const pendingPayments = await tx.payment.count({ where: { status: "PENDING" } });

    const openFlags = await tx.redFlag.count({ where: { status: "OPEN" } });

    return {
      counts: { students, teachers, classes: totalClasses, parents },
      attendanceToday: {
        breakdown: toBreakdown(attendanceGroups),
        classesMarked: markedClasses.length,
        totalClasses,
      },
      staffToday: {
        breakdown: toBreakdown(staffGroups),
        totalStaff: teachers,
      },
      fees: {
        period,
        billedThisMonth: num(billed._sum.total),
        collectedThisMonth: num(billed._sum.paidAmount),
        outstandingTotal: num(outstanding._sum.total) - num(outstanding._sum.paidAmount),
        outstandingInvoices: outstanding._count._all,
        pendingPayments,
      },
      redFlags: { open: openFlags, recent: [] as RedFlagRow[] },
    };
  });

  // The recent-flags list runs its own tenant transaction via the service, so
  // read it separately and take the five newest open ones.
  const openFlags = await listRedFlags({ status: "OPEN" });
  data.redFlags.recent = openFlags.slice(0, 5);

  return data;
}
