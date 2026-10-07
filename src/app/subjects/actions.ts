"use server";

import { refresh } from "next/cache";
import { Prisma } from "@prisma/client";
import { z } from "zod";

import { requireRole } from "@/server/auth/dal";
import { createSubject, deleteSubject } from "@/server/academics/subjects";
import type { FormState } from "@/app/subjects/form-state";

const subjectSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(60),
  code: z
    .string()
    .trim()
    .max(16)
    .transform((v) => (v === "" ? null : v)),
});

export async function createSubjectAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireRole("HEAD");

  const parsed = subjectSchema.safeParse({
    name: formData.get("name"),
    code: formData.get("code") ?? "",
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      fieldErrors[key] ??= issue.message;
    }
    return { status: "error", message: "Please fix the errors.", fieldErrors };
  }

  try {
    await createSubject(parsed.data);
    refresh();
    return { status: "success", message: "Subject added." };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return {
        status: "error",
        message: "That subject already exists.",
        fieldErrors: { name: "Already exists" },
      };
    }
    throw error;
  }
}

export async function deleteSubjectAction(formData: FormData): Promise<void> {
  await requireRole("HEAD");
  const id = String(formData.get("id") ?? "");
  if (id) {
    await deleteSubject(id);
    refresh();
  }
}
