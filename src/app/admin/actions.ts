"use server";

import { refresh } from "next/cache";
import { Prisma } from "@prisma/client";
import { z } from "zod";

import { requireSuperAdmin } from "@/server/auth/dal";
import { createSchoolWithHead } from "@/server/schools/onboarding";

export type CreateSchoolState = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Partial<Record<keyof z.infer<typeof schema>, string>>;
  createdSlug?: string;
};

export const initialCreateSchoolState: CreateSchoolState = { status: "idle" };

const schema = z.object({
  schoolName: z.string().trim().min(2, "School name is too short").max(100),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers, and hyphens"),
  headName: z.string().trim().min(2, "Name is too short").max(100),
  headEmail: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Enter a valid email"),
  headPassword: z.string().min(8, "Use at least 8 characters").max(200),
});

export async function createSchoolAction(
  _prev: CreateSchoolState,
  formData: FormData,
): Promise<CreateSchoolState> {
  // Defense in depth: the /admin page already guards, but Server Actions are
  // reachable by direct POST, so re-verify here.
  await requireSuperAdmin();

  const parsed = schema.safeParse({
    schoolName: formData.get("schoolName"),
    slug: formData.get("slug"),
    headName: formData.get("headName"),
    headEmail: formData.get("headEmail"),
    headPassword: formData.get("headPassword"),
  });

  if (!parsed.success) {
    const fieldErrors: CreateSchoolState["fieldErrors"] = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0] as keyof z.infer<typeof schema>;
      fieldErrors[key] ??= issue.message;
    }
    return { status: "error", message: "Please fix the errors below.", fieldErrors };
  }

  try {
    const { slug } = await createSchoolWithHead(parsed.data);
    refresh(); // re-render the (uncached) schools list
    return {
      status: "success",
      message: "School created. The HEAD can now sign in using the school slug below.",
      createdSlug: slug,
    };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return {
        status: "error",
        message: "That slug is already in use.",
        fieldErrors: { slug: "Already taken" },
      };
    }
    throw error;
  }
}
