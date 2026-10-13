import "server-only";

import type { AttendanceStatus } from "@prisma/client";

import { requireSchool } from "@/server/auth/dal";
import { withTenant } from "@/server/db/tenant";
import { toDateOnly, type StatusCounts } from "@/server/academics/attendance";

/**
 * Staff attendance (Module 8.1). Daily, one record per staff member (a TEACHER
 * User) per calendar day. Marked and reviewed by the HEAD only - role gating
 * lives in the route actions/pages; every read and write runs inside the tenant
 * RLS context so rows never cross schools. Mirrors student attendance, but flat
 * (no class/section) and with no parent alerts.
 */

/** Half-open UTC range [start, end) for a "YYYY-MM" month. */
function monthRange(month: string): { start: Date; end: Date } {
  const [y, m] = month.split("-").map(Number);
  return { start: new Date(Date.UTC(y, m - 1, 1)), end: new Date(Date.UTC(y, m, 1)) };
}

function tally(records: { status: AttendanceStatus }[]): StatusCounts {
  const counts: StatusCounts = { PRESENT: 0, ABSENT: 0, LATE: 0, LEAVE: 0, total: records.length };
  for (const r of records) counts[r.status] += 1;
  return counts;
}

export type StaffRosterRow = {
  staffId: string;
  name: string;
  email: string;
  mainSubject: string | null;
  record: { id: string; status: AttendanceStatus; note: string | null } | null;
};

/**
 * The staff roster for one date: every active teacher paired with that day's
 * record (if any), for the marking grid. Ordered by name.
 */
export async function getStaffAttendanceForDate(input: { date: Date }) {
  const { schoolId } = await requireSchool();
  const date = toDateOnly(input.date);
  return withTenant(schoolId, async (tx) => {
    const staff = await tx.user.findMany({
      where: { role: "TEACHER", isActive: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        email: true,
        mainSubject: { select: { name: true } },
        staffAttendance: {
          where: { date },
          select: { id: true, status: true, note: true },
          take: 1,
        },
      },
    });

    return {
      date,
      roster: staff.map((s): StaffRosterRow => ({
        staffId: s.id,
        name: s.name,
        email: s.email,
        mainSubject: s.mainSubject?.name ?? null,
        record: s.staffAttendance[0] ?? null,
      })),
    };
  });
}

export type StaffAttendanceEntry = {
  staffId: string;
  status: AttendanceStatus;
  note: string | null;
};

/**
 * Record (or overwrite) staff attendance for a date. Idempotent per staff
 * member via the `(staffId, date)` unique key. Entries for anyone who isn't a
 * TEACHER in this tenant are rejected (RLS doesn't guard FK targets, so the set
 * of valid staff is re-checked in-tenant; see the RLS FK gap note). `markedBy`
 * is the acting HEAD, set server-side.
 */
export async function saveStaffAttendance(input: { date: Date; entries: StaffAttendanceEntry[] }) {
  const { user, schoolId } = await requireSchool();
  const date = toDateOnly(input.date);

  return withTenant(schoolId, async (tx) => {
    const staff = await tx.user.findMany({
      where: { role: "TEACHER" },
      select: { id: true },
    });
    const validIds = new Set(staff.map((s) => s.id));

    let saved = 0;
    for (const entry of input.entries) {
      if (!validIds.has(entry.staffId)) {
        throw new Error("That staff member isn't part of this school");
      }
      const note = entry.note?.trim() ? entry.note.trim() : null;
      await tx.staffAttendance.upsert({
        where: { staffId_date: { staffId: entry.staffId, date } },
        create: {
          schoolId,
          staffId: entry.staffId,
          date,
          status: entry.status,
          note,
          markedById: user.id,
        },
        update: { status: entry.status, note, markedById: user.id },
      });
      saved += 1;
    }

    return { saved };
  });
}

export type StaffOverviewRow = {
  staffId: string;
  name: string;
  mainSubject: string | null;
  present: number;
  total: number;
};

/**
 * This-month present/total marked days for every active teacher, for the
 * summary table's progress bars. PRESENT and LATE both count as present (a late
 * arrival still showed up), matching the student overview.
 */
export async function getStaffAttendanceOverview(input: { month: string }) {
  const { schoolId } = await requireSchool();
  const { start, end } = monthRange(input.month);
  return withTenant(schoolId, async (tx) => {
    const staff = await tx.user.findMany({
      where: { role: "TEACHER", isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, mainSubject: { select: { name: true } } },
    });

    const records = await tx.staffAttendance.findMany({
      where: { date: { gte: start, lt: end } },
      select: { staffId: true, status: true },
    });

    const byStaff = new Map<string, { present: number; total: number }>();
    for (const r of records) {
      const agg = byStaff.get(r.staffId) ?? { present: 0, total: 0 };
      agg.total += 1;
      if (r.status === "PRESENT" || r.status === "LATE") agg.present += 1;
      byStaff.set(r.staffId, agg);
    }

    const rows: StaffOverviewRow[] = staff.map((s) => {
      const agg = byStaff.get(s.id) ?? { present: 0, total: 0 };
      return {
        staffId: s.id,
        name: s.name,
        mainSubject: s.mainSubject?.name ?? null,
        present: agg.present,
        total: agg.total,
      };
    });

    return { month: input.month, rows };
  });
}

/** One staff member's attendance for a month, with per-status counts. */
export async function getStaffMemberAttendance(input: { staffId: string; month: string }) {
  const { schoolId } = await requireSchool();
  return withTenant(schoolId, async (tx) => {
    const staff = await tx.user.findFirst({
      where: { id: input.staffId, role: "TEACHER" },
      select: { id: true, name: true, email: true, mainSubject: { select: { name: true } } },
    });
    if (!staff) throw new Error("Staff member not found");

    const { start, end } = monthRange(input.month);
    const records = await tx.staffAttendance.findMany({
      where: { staffId: input.staffId, date: { gte: start, lt: end } },
      orderBy: { date: "desc" },
      select: { id: true, date: true, status: true, note: true },
    });

    return { staff, month: input.month, records, counts: tally(records) };
  });
}
