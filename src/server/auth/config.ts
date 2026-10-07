import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";

import { prisma } from "@/server/db";
import { verifyPassword } from "@/server/auth/password";

/**
 * Auth.js (v5) configuration.
 *
 * We use the Credentials provider with a JWT session strategy (database
 * sessions aren't supported alongside Credentials). The session token carries
 * the two facts every tenant-scoped query needs - the user's `role` and
 * `schoolId` - so route guards (Module 1.4) and tenant resolution (Module 1.5)
 * can read them without an extra DB round-trip.
 *
 * Tenant login vs. platform login:
 *   - A tenant user signs in with their school's `slug` (later supplied
 *     automatically by the tenant middleware; for now it's a login field).
 *   - A SUPER_ADMIN signs in with no slug - they have `schoolId = null`.
 */
export const authConfig = {
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: {
        email: {},
        password: {},
        school: {},
      },
      async authorize(credentials) {
        const email =
          typeof credentials.email === "string" ? credentials.email.toLowerCase().trim() : "";
        const password = typeof credentials.password === "string" ? credentials.password : "";
        const slug = typeof credentials.school === "string" ? credentials.school.trim() : "";

        if (!email || !password) {
          return null;
        }

        const user = slug
          ? await resolveTenantUser(slug, email)
          : await prisma.user.findFirst({ where: { schoolId: null, email } });

        if (!user || !user.isActive) {
          return null;
        }

        const ok = await verifyPassword(password, user.passwordHash);
        if (!ok) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          schoolId: user.schoolId,
        };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      // `user` is only present on initial sign-in; persist our extra claims.
      if (user) {
        token.role = user.role;
        token.schoolId = user.schoolId;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.sub ?? "";
      session.user.role = token.role;
      session.user.schoolId = token.schoolId;
      return session;
    },
  },
} satisfies NextAuthConfig;

/** Look up an active user within the school identified by `slug`. */
async function resolveTenantUser(slug: string, email: string) {
  const school = await prisma.school.findUnique({ where: { slug } });
  if (!school || !school.isActive) {
    return null;
  }
  return prisma.user.findUnique({
    where: { schoolId_email: { schoolId: school.id, email } },
  });
}
