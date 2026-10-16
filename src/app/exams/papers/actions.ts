"use server";

import { refresh } from "next/cache";
import { z } from "zod";

import { requireRole } from "@/server/auth/dal";
import {
  deleteExamPaper,
  reviewExamPaper,
  submitExamPaper,
  updateMyExamPaper,
} from "@/server/academics/exam-papers";
import type { FormState } from "@/app/exams/form-state";

const paperSchema = z.object({
  classId: z.string().min(1, "Pick a class"),
  subjectId: z.string().min(1, "Pick a subject"),
  title: z.string().trim().min(1, "Title is required").max(140),
  // Date inputs submit "YYYY-MM-DD".
  examDate: z.coerce.date({ message: "Pick the exam date" }),
  fileUrl: z
    .string()
    .trim()
    .min(1, "Paste a link to the paper")
    .max(2048)
    .refine((v) => /^https?:\/\//i.test(v), "Must be a link starting with http(s)://"),
  notes: z
    .string()
    .trim()
    .max(500)
    .transform((v) => (v === "" ? null : v)),
});

function parsePaper(formData: FormData) {
  return paperSchema.safeParse({
    classId: formData.get("classId"),
    subjectId: formData.get("subjectId"),
    title: formData.get("title"),
    examDate: String(formData.get("examDate") ?? "").trim() || undefined,
    fileUrl: formData.get("fileUrl") ?? "",
    notes: formData.get("notes") ?? "",
  });
}

function fieldErrorsOf(parsed: z.ZodError): Record<string, string> {
  const fieldErrors: Record<string, string> = {};
  for (const issue of parsed.issues) {
    const key = String(issue.path[0] ?? "form");
    fieldErrors[key] ??= issue.message;
  }
  return fieldErrors;
}

export async function submitExamPaperAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireRole("TEACHER", "HEAD");

  const parsed = parsePaper(formData);
  if (!parsed.success) {
    return { status: "error", message: "Please fix the errors.", fieldErrors: fieldErrorsOf(parsed.error) };
  }

  try {
    await submitExamPaper(parsed.data);
    refresh();
    return { status: "success", message: "Paper submitted for review." };
  } catch (error) {
    if (error instanceof Error) return { status: "error", message: error.message };
    throw error;
  }
}

export async function updateExamPaperAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireRole("TEACHER", "HEAD");

  const id = String(formData.get("id") ?? "");
  if (!id) return { status: "error", message: "Missing paper." };

  const parsed = parsePaper(formData);
  if (!parsed.success) {
    return { status: "error", message: "Please fix the errors.", fieldErrors: fieldErrorsOf(parsed.error) };
  }

  try {
    await updateMyExamPaper({ id, ...parsed.data });
    refresh();
    return { status: "success", message: "Paper updated and re-submitted." };
  } catch (error) {
    if (error instanceof Error) return { status: "error", message: error.message };
    throw error;
  }
}

export async function reviewExamPaperAction(formData: FormData): Promise<void> {
  await requireRole("HEAD");
  const id = String(formData.get("id") ?? "");
  const decision = String(formData.get("decision") ?? "");
  const note = String(formData.get("reviewNote") ?? "").trim();
  if (!id || (decision !== "APPROVED" && decision !== "CHANGES_REQUESTED")) return;
  await reviewExamPaper(id, decision, note === "" ? null : note);
  refresh();
}

export async function deleteExamPaperAction(formData: FormData): Promise<void> {
  await requireRole("TEACHER", "HEAD");
  const id = String(formData.get("id") ?? "");
  if (id) {
    await deleteExamPaper(id);
    refresh();
  }
}
