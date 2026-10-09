"use server";

import { refresh } from "next/cache";
import { z } from "zod";

import { requireRole } from "@/server/auth/dal";
import { createDiaryEntry, deleteDiaryEntry } from "@/server/academics/diary";
import type { FormState } from "@/app/homework/form-state";

const diarySchema = z.object({
  classId: z.string().min(1, "Pick a class"),
  sectionId: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : v)),
  subjectId: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : v)),
  type: z.enum(["HOMEWORK", "NOTE"]),
  // Date inputs submit "YYYY-MM-DD"; coerce to a Date (UTC midnight).
  date: z.coerce.date(),
  title: z.string().trim().min(1, "Title is required").max(140),
  content: z.string().trim().min(1, "Details are required").max(4000),
  // Empty string is normalized to null before parsing (see below).
  dueDate: z.coerce.date().nullable(),
});

export async function createDiaryEntryAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireRole("TEACHER", "HEAD");

  const rawDue = String(formData.get("dueDate") ?? "").trim();
  const parsed = diarySchema.safeParse({
    classId: formData.get("classId"),
    sectionId: formData.get("sectionId") ?? "",
    subjectId: formData.get("subjectId") ?? "",
    type: formData.get("type"),
    date: formData.get("date"),
    title: formData.get("title"),
    content: formData.get("content"),
    dueDate: rawDue === "" ? null : rawDue,
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
    const { notified } = await createDiaryEntry(parsed.data);
    refresh();
    const suffix =
      notified > 0 ? ` ${notified} ${notified === 1 ? "parent" : "parents"} notified.` : "";
    return { status: "success", message: `Posted.${suffix}` };
  } catch (error) {
    if (error instanceof Error) {
      return { status: "error", message: error.message };
    }
    throw error;
  }
}

export async function deleteDiaryEntryAction(formData: FormData): Promise<void> {
  await requireRole("TEACHER", "HEAD");
  const id = String(formData.get("id") ?? "");
  if (id) {
    await deleteDiaryEntry(id);
    refresh();
  }
}
