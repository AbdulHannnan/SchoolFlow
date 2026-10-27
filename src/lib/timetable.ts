import type { Weekday } from "@prisma/client";

/** The teaching week in order; drives selects and sorting display. Isomorphic. */
export const WEEKDAYS: Weekday[] = ["MON", "TUE", "WED", "THU", "FRI", "SAT"];

export const WEEKDAY_LABELS: Record<Weekday, string> = {
  MON: "Mon",
  TUE: "Tue",
  WED: "Wed",
  THU: "Thu",
  FRI: "Fri",
  SAT: "Sat",
};

/**
 * Default bell schedule. The data model stores only a period number, so this
 * maps it to a clock time for display: periods are `PERIOD_MINUTES` long, back
 * to back from `DAY_START_MINUTES`. Isomorphic (no imports), 24-hour so it reads
 * the same everywhere.
 */
export const DAY_START_MINUTES = 8 * 60; // 08:00
export const PERIOD_MINUTES = 45;

function clock(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** A period's clock window, e.g. "08:00-08:45". */
export function periodTime(period: number): string {
  const start = DAY_START_MINUTES + (period - 1) * PERIOD_MINUTES;
  return `${clock(start)}-${clock(start + PERIOD_MINUTES)}`;
}
