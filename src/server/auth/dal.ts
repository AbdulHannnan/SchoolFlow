import "server-only";

import { cache } from "react";
import { forbidden, redirect } from "next/navigation";
import { connection } from "next/server";
import type { Role } from "@prisma/client";
import type { Session } from "next-auth";

import type { Prisma } from "@prisma/client";

import { auth } from "@/server/auth";
import { hasSchool, isRoleAllowed } from "@/server/auth/policy";
import { withTenant } from "@/server/db/tenant";

type SessionUser = Session["user"];

/**
 * Data Access Layer (DAL) - the single place authorization is enforced.
 *
 * With Cache Components enabled these all read the session (cookies) at request
 * time, so they must be called from inside a `<Suspense>` boundary (e.g. a
 * component the page streams in), never at the top level of a layout/page.
 *
 * Two kinds of failure, two behaviours:
 *   - not signed in        -> `redirect("/login")`
 *   - signed in, wrong role -> `forbidden()` (renders the 403 boundary)
 *
 * `verifySession` is wrapped in React's `cache` so repeated calls within one
 * request resolve the session once.
 */

/** The raw session user, or `null` when signed out. Does not redirect. */
export async function getSessionUser(): Promise<SessionUser | null> {
  // The session is request-time data, and Auth.js's `auth()` generates a CSRF
  // token (`crypto.getRandomValues()`) on every call. Under Cache Components
  // that unstable value aborts the static prerender, so mark this request-time
  // *before* calling `auth()`: prerendering stops here and the session (always
  // behind a Suspense boundary) streams in at request time.
  await connection();
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
  if (!isRoleAllowed(user, allowed)) {
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
 * non-null string. SUPER_ADMIN (no school) is rejected with `forbidden()` -
 * use this to guard anything that reads or writes one school's data.
 */
export async function requireSchool(): Promise<{ user: SessionUser; schoolId: string }> {
  const user = await verifySession();
  if (!hasSchool(user)) {
    forbidden();
  }
  return { user, schoolId: user.schoolId };
}

/** Non-throwing role check for conditional UI (e.g. hiding a nav item). */
export function hasRole(user: SessionUser | null, ...allowed: Role[]): boolean {
  return isRoleAllowed(user, allowed);
}

/**
 * Resolve the active tenant from the session and run `fn` inside that school's
 * RLS context. This is how tenant-scoped data access happens throughout the
 * app - the schoolId is never taken from the client, only from the session.
 *
 *   const classes = await withCurrentTenant((tx) => tx.class.findMany());
 */
export async function withCurrentTenant<T>(
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  const { schoolId } = await requireSchool();
  return withTenant(schoolId, fn);
}
