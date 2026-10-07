import "server-only";

import { prisma } from "@/server/db";
import { hashPassword } from "@/server/auth/password";

/**
 * Tenant onboarding (Module 1.6).
 *
 * Runs on the OWNER connection (bypasses RLS): a new school and its first user
 * can't be created from inside any tenant's RLS context. The caller must be a
 * SUPER_ADMIN - enforced in the Server Action, not here.
 */
export type CreateSchoolInput = {
  schoolName: string;
  slug: string;
  headName: string;
  headEmail: string;
  headPassword: string;
};

/** Create a school and its first HEAD account atomically. */
export async function createSchoolWithHead(
  input: CreateSchoolInput,
): Promise<{ schoolId: string; slug: string; headEmail: string }> {
  const passwordHash = await hashPassword(input.headPassword);

  return prisma.$transaction(async (tx) => {
    const school = await tx.school.create({
      data: { name: input.schoolName, slug: input.slug },
    });

    await tx.user.create({
      data: {
        schoolId: school.id,
        email: input.headEmail,
        name: input.headName,
        role: "HEAD",
        passwordHash,
      },
    });

    return { schoolId: school.id, slug: school.slug, headEmail: input.headEmail };
  });
}
