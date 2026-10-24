import type { Role } from "@prisma/client";

/**
 * Pure role-authorization kernel.
 *
 * This is the single source of truth for "may a user with role X do this?".
 * It holds no I/O - no session read, no DB, no `next/navigation` - so it is
 * trivially unit-testable and safe to import from anywhere (including plain
 * Node test files; the type-only import above is erased at runtime).
 *
 * The throwing / redirecting gates in `dal.ts` are thin wrappers around these
 * predicates, so a role decision is decided in exactly one place.
 */

/** The minimal user shape a role decision needs; a superset of this is fine. */
export type PolicyUser = { role: Role; schoolId: string | null };

/** True when `user` exists and holds one of the `allowed` roles. */
export function isRoleAllowed(
  user: PolicyUser | null | undefined,
  allowed: readonly Role[],
): boolean {
  return user != null && allowed.includes(user.role);
}

/** True for the platform operator (SUPER_ADMIN), which has no tenant. */
export function isSuperAdmin(user: PolicyUser | null | undefined): boolean {
  return isRoleAllowed(user, ["SUPER_ADMIN"]);
}

/**
 * True when `user` is a tenant-scoped account (has a `schoolId`). A type guard,
 * so callers get `schoolId` narrowed to `string` on the true branch. Note a
 * SUPER_ADMIN always fails this - it operates above any single school.
 */
export function hasSchool<T extends { schoolId: string | null }>(
  user: T | null | undefined,
): user is T & { schoolId: string } {
  // Truthiness (not just `!= null`): an empty `schoolId` is not a real tenant
  // and must be denied, so we never run `withTenant("")` on a malformed row.
  return user != null && Boolean(user.schoolId);
}
