"use server";

import { refresh } from "next/cache";
import { Prisma } from "@prisma/client";
import { z } from "zod";

import { requireRole } from "@/server/auth/dal";
import { createParent, deleteParent, linkStudent, unlinkStudent } from "@/server/academics/parents";
import type { FormState } from "@/app/parents/form-state";

const parentSchema = z.object({
  name: z.string().trim().min(2, "Name is too short").max(100),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Enter a valid email"),
  password: z.string().min(8, "Use at least 8 characters").max(200),
});

const linkSchema = z.object({
  parentId: z.string().min(1),
  studentId: z.string().min(1, "Pick a student"),
  relation: z
    .enum(["FATHER", "MOTHER", "GUARDIAN", "OTHER"])
    .or(z.literal(""))
    .transform((v) => (v === "" ? null : v)),
});

function toFieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    out[key] ??= issue.message;
  }
  return out;
}

export async function createParentAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireRole("HEAD");

  const parsed = parentSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the errors.",
      fieldErrors: toFieldErrors(parsed.error),
    };
  }

  try {
    await createParent(parsed.data);
    refresh();
    return { status: "success", message: "Parent added." };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return {
        status: "error",
        message: "A user with that email already exists in this school.",
        fieldErrors: { email: "Already in use" },
      };
    }
    throw error;
  }
}

export async function linkStudentAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireRole("HEAD");

  const parsed = linkSchema.safeParse({
    parentId: formData.get("parentId"),
    studentId: formData.get("studentId"),
    relation: formData.get("relation") ?? "",
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the errors.",
      fieldErrors: toFieldErrors(parsed.error),
    };
  }

  try {
    await linkStudent(parsed.data);
    refresh();
    return { status: "success", message: "Student linked." };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { status: "error", message: "That student is already linked to this parent." };
    }
    throw error;
  }
}

export async function deleteParentAction(formData: FormData): Promise<void> {
  await requireRole("HEAD");
  const id = String(formData.get("id") ?? "");
  if (id) {
    await deleteParent(id);
    refresh();
  }
}

export async function unlinkStudentAction(formData: FormData): Promise<void> {
  await requireRole("HEAD");
  const id = String(formData.get("id") ?? "");
  if (id) {
    await unlinkStudent(id);
    refresh();
  }
}
