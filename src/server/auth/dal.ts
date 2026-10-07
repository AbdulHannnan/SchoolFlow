import "server-only";

import { cache } from "react";
import { forbidden, redirect } from "next/navigation";
import type { Role } from "@prisma/client";
import type { Session } from "next-auth";

import { auth } from "@/server/auth";

type SessionUser = Session["user"];

/**
 * Data Access Layer (DAL) — the single place authorization is enforced.
 *
 * With Cache Components enabled these all read the session (cookies) at request
 * time, so they must be called from inside a `<Suspense>` boundary (e.g. a
 * component the page streams in), never at the top level of a layout/page.
 *
 * Two kinds of failure, two behaviours:
 *   - not signed in        → `redirect("/login")`
 *   - signed in, wrong role → `forbidden()` (renders the 403 boundary)
 *
 * `verifySession` is wrapped in React's `cache` so repeated calls within one
 * request resolve the session once.
 */

/** The raw session user, or `null` when signed out. Does not redirect. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth();
  return session?.user ?? null;
}

/** Require an authenticated user; redirect to the login page if there isn't one. */
export const verifySession = cache(async (): Promise<SessionUser> => {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }
  return user;
});

/** Require one of `allowed` roles; `forbidden()` (403) if the user lacks them. */
export async function requireRole(...allowed: Role[]): Promise<SessionUser> {
  const user = await verifySession();
  if (!allowed.includes(user.role)) {
    forbidden();
  }
  return user;
}

/** Require the platform operator. */
export async function requireSuperAdmin(): Promise<SessionUser> {
  return requireRole("SUPER_ADMIN");
}

/**
 * Require a tenant-scoped user and return their `schoolId` narrowed to a
 * non-null string. SUPER_ADMIN (no school) is rejected with `forbidden()` —
 * use this to guard anything that reads or writes one school's data.
 */
export async function requireSchool(): Promise<{ user: SessionUser; schoolId: string }> {
  const user = await verifySession();
  if (!user.schoolId) {
    forbidden();
  }
  return { user, schoolId: user.schoolId };
}

/** Non-throwing role check for conditional UI (e.g. hiding a nav item). */
export function hasRole(user: SessionUser | null, ...allowed: Role[]): boolean {
  return user != null && allowed.includes(user.role);
}
