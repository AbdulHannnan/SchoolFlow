"use server";

import { refresh } from "next/cache";
import { z } from "zod";

import { requireRole } from "@/server/auth/dal";
import {
  createPlannerEntry,
  deletePlannerEntry,
  setPlannerStatus,
} from "@/server/academics/planner";
import type { FormState } from "@/app/planner/form-state";

const plannerSchema = z.object({
  classId: z.string().min(1, "Pick a class"),
  subjectId: z.string().min(1, "Pick a subject"),
  // The date input submits "YYYY-MM-DD"; coerce to a Date (UTC midnight).
  date: z.coerce.date(),
  topic: z.string().trim().min(1, "Topic is required").max(140),
  details: z.string().trim().min(1, "Plan details are required").max(4000),
  homework: z
    .string()
    .trim()
    .max(2000)
    .transform((v) => (v === "" ? null : v)),
});

export async function createPlannerEntryAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireRole("TEACHER");

  const parsed = plannerSchema.safeParse({
    classId: formData.get("classId"),
    subjectId: formData.get("subjectId"),
    date: formData.get("date"),
    topic: formData.get("topic"),
    details: formData.get("details"),
    homework: formData.get("homework") ?? "",
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
    await createPlannerEntry(parsed.data);
    refresh();
    return { status: "success", message: "Saved to your planner." };
  } catch (error) {
    if (error instanceof Error) {
      return { status: "error", message: error.message };
    }
    throw error;
  }
}

export async function setPlannerStatusAction(formData: FormData): Promise<void> {
  await requireRole("TEACHER");
  const id = String(formData.get("id") ?? "");
  const status = formData.get("status") === "COMPLETED" ? "COMPLETED" : "PLANNED";
  if (id) {
    await setPlannerStatus(id, status);
    refresh();
  }
}

export async function deletePlannerEntryAction(formData: FormData): Promise<void> {
  await requireRole("TEACHER", "HEAD");
  const id = String(formData.get("id") ?? "");
  if (id) {
    await deletePlannerEntry(id);
    refresh();
  }
}
