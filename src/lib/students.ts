import type { Gender } from "@prisma/client";

/**
 * Student presentation helpers. Isomorphic (no server-only imports) so pages and
 * client components can share them.
 */

/** Whole years from a date of birth to today (UTC, matching the date-only column). */
export function ageFromDob(dob: Date): number {
  const now = new Date();
  let age = now.getUTCFullYear() - dob.getUTCFullYear();
  const monthDiff = now.getUTCMonth() - dob.getUTCMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getUTCDate() < dob.getUTCDate())) {
    age -= 1;
  }
  return age;
}

/** Format a normalized 13-digit CNIC as XXXXX-XXXXXXX-X; pass anything else through. */
export function formatCnic(cnic: string): string {
  return /^\d{13}$/.test(cnic) ? `${cnic.slice(0, 5)}-${cnic.slice(5, 12)}-${cnic.slice(12)}` : cnic;
}

const GENDER_LABELS: Record<Gender, string> = {
  MALE: "Male",
  FEMALE: "Female",
  OTHER: "Other",
};

export function genderLabel(gender: Gender | null): string | null {
  return gender ? GENDER_LABELS[gender] : null;
}
