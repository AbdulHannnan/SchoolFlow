/**
 * Non-teaching staff presentation helpers. Isomorphic (no server-only imports),
 * so both the server pages and client forms share one source of role labels.
 */
import type { SupportStaffRole } from "@prisma/client";

/** Dropdown/display labels for each support-staff role (local terms in parens). */
export const SUPPORT_STAFF_ROLE_LABELS: Record<SupportStaffRole, string> = {
  DRIVER: "Driver",
  GARDENER: "Gardener (Malee)",
  MAID: "Maid (Khala)",
  CLERK: "Clerk",
  GUARD: "Guard (Chowkidar)",
  COOK: "Cook",
  SWEEPER: "Sweeper",
  PEON: "Peon",
  ACCOUNTANT: "Accountant",
  OTHER: "Other",
};

/** Roles in the order they appear in the add/edit dropdowns. */
export const SUPPORT_STAFF_ROLES: SupportStaffRole[] = [
  "DRIVER",
  "GARDENER",
  "MAID",
  "CLERK",
  "GUARD",
  "COOK",
  "SWEEPER",
  "PEON",
  "ACCOUNTANT",
  "OTHER",
];

/**
 * The label to show for a staff member: the free-text `customRole` when the
 * role is OTHER (falling back to "Other" if it's blank), else the fixed label.
 */
export function staffRoleLabel(role: SupportStaffRole, customRole?: string | null): string {
  if (role === "OTHER") {
    const custom = customRole?.trim();
    return custom && custom.length > 0 ? custom : SUPPORT_STAFF_ROLE_LABELS.OTHER;
  }
  return SUPPORT_STAFF_ROLE_LABELS[role];
}
