import type { AttendanceStatus } from "@prisma/client";

/**
 * Shared presentation for attendance status - labels and themed badge classes,
 * used by both the teacher marking grid and the Head/Parent views so a status
 * always reads the same. Isomorphic (no server-only imports).
 */
export const ATTENDANCE_STATUS: {
  value: AttendanceStatus;
  label: string;
  badgeClass: string;
}[] = [
  {
    value: "PRESENT",
    label: "Present",
    badgeClass:
      "border-transparent bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400",
  },
  {
    value: "ABSENT",
    label: "Absent",
    badgeClass: "border-transparent bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400",
  },
  {
    value: "LATE",
    label: "Late",
    badgeClass:
      "border-transparent bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
  },
  {
    value: "LEAVE",
    label: "Leave",
    badgeClass:
      "border-transparent bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400",
  },
];

const BY_VALUE = new Map(ATTENDANCE_STATUS.map((s) => [s.value, s]));

export function statusLabel(status: AttendanceStatus): string {
  return BY_VALUE.get(status)?.label ?? status;
}

export function statusBadgeClass(status: AttendanceStatus): string {
  return BY_VALUE.get(status)?.badgeClass ?? "";
}

/** Current month as "YYYY-MM" (UTC). */
export function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

/** Validate a "YYYY-MM" string, falling back to the current month. */
export function normalizeMonth(month: string | undefined): string {
  return month && /^\d{4}-\d{2}$/.test(month) ? month : currentMonth();
}

/** Step a "YYYY-MM" month by `delta` months. */
export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
}

/** Human month heading, e.g. "October 2026". */
export function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** A single record's date, e.g. "Mon, 8 Oct". */
export function formatAttendanceDate(date: Date): string {
  return date.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

/** A full day, e.g. "8 Oct 2026" (UTC). */
export function formatDay(date: Date): string {
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Today as "YYYY-MM-DD" (UTC). */
export function todayISODate(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Validate a "YYYY-MM-DD" string, falling back to today. */
export function normalizeDate(date: string | undefined): string {
  return date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : todayISODate();
}

/** Percentage present, or null when nothing was marked. */
export function presentRate(present: number, total: number): number | null {
  return total > 0 ? Math.round((present / total) * 100) : null;
}

export type RangePreset = "today" | "week" | "month";

/** A from/to "YYYY-MM-DD" range for a preset, ending today (all UTC). */
export function presetRange(preset: RangePreset): { from: string; to: string } {
  const now = new Date();
  const to = now.toISOString().slice(0, 10);
  if (preset === "today") return { from: to, to };
  if (preset === "month") {
    const first = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    return { from: first.toISOString().slice(0, 10), to };
  }
  // week: back to Monday (UTC).
  const day = now.getUTCDay(); // 0 = Sun
  const offset = day === 0 ? 6 : day - 1;
  const monday = new Date(now.getTime() - offset * 24 * 60 * 60 * 1000);
  return { from: monday.toISOString().slice(0, 10), to };
}
