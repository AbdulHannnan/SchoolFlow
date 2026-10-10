import type { ExamType } from "@prisma/client";

/**
 * Grade/marks presentation (Module 7). Marks are stored as fixed-scale decimals
 * and carried around as strings (like money); this formats them and maps a
 * percentage to a letter grade. Isomorphic (no server-only imports), so both
 * server and client components can use it.
 */

export const EXAM_TYPE_LABELS: Record<ExamType, string> = {
  TERM: "Term exam",
  MIDTERM: "Mid-term",
  FINAL: "Final",
  MONTHLY: "Monthly test",
  QUIZ: "Quiz",
  ASSIGNMENT: "Assignment",
  OTHER: "Other",
};

export const EXAM_TYPE_OPTIONS = (Object.keys(EXAM_TYPE_LABELS) as ExamType[]).map((value) => ({
  value,
  label: EXAM_TYPE_LABELS[value],
}));

/** Default grade bands, highest threshold first. */
const GRADE_BANDS: { min: number; grade: string }[] = [
  { min: 90, grade: "A+" },
  { min: 80, grade: "A" },
  { min: 70, grade: "B" },
  { min: 60, grade: "C" },
  { min: 50, grade: "D" },
  { min: 0, grade: "F" },
];

/** Letter grade for a 0-100 percentage. */
export function letterGrade(percent: number): string {
  for (const band of GRADE_BANDS) {
    if (percent >= band.min) return band.grade;
  }
  return "F";
}

/** Percentage (0-100, one decimal) from obtained/max, or null when max <= 0. */
export function percentage(obtained: number, max: number): number | null {
  if (!(max > 0)) return null;
  return Math.round((obtained / max) * 1000) / 10;
}

/**
 * Display marks: the number (trailing ".00" dropped), a dash when not yet
 * entered, or "AB" for an absent student.
 */
export function formatMarks(value: string | number | null, absent = false): string {
  if (absent) return "AB";
  if (value === null || value === "") return "—";
  const n = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(n)) return String(value);
  return String(n);
}

/** Display a percentage like "87.5%", or a dash for null. */
export function formatPercent(percent: number | null): string {
  return percent === null ? "—" : `${percent}%`;
}
