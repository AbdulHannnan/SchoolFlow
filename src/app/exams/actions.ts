"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireRole } from "@/server/auth/dal";
import {
  createExam,
  deleteExam,
  savePaperResults,
  setExamPublished,
  type ResultEntry,
} from "@/server/academics/exams";
import type { FormState } from "@/app/exams/form-state";

// Marks: up to 4 integer digits and 2 decimals (matches DECIMAL(6,2)).
const marksRe = /^\d{1,4}(\.\d{1,2})?$/;

const examSchema = z.object({
  classId: z.string().min(1, "Pick a class"),
  name: z.string().trim().min(1, "Name is required").max(140),
  type: z.enum(["TERM", "MIDTERM", "FINAL", "MONTHLY", "QUIZ", "ASSIGNMENT", "OTHER"]),
  term: z
    .string()
    .trim()
    .max(60)
    .transform((v) => (v === "" ? null : v)),
  // Date inputs submit "YYYY-MM-DD"; empty is normalized to null before parsing.
  startDate: z.coerce.date().nullable(),
});

export async function createExamAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireRole("HEAD");

  const rawStart = String(formData.get("startDate") ?? "").trim();
  const parsed = examSchema.safeParse({
    classId: formData.get("classId"),
    name: formData.get("name"),
    type: formData.get("type"),
    term: formData.get("term") ?? "",
    startDate: rawStart === "" ? null : rawStart,
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      fieldErrors[key] ??= issue.message;
    }
    return { status: "error", message: "Please fix the errors.", fieldErrors };
  }

  // Each checked subject contributes `max_<id>` and optional `pass_<id>`.
  const includeIds = [...new Set(formData.getAll("subject").map(String).filter(Boolean))];
  if (includeIds.length === 0) {
    return { status: "error", message: "Select at least one subject." };
  }

  const subjects: { subjectId: string; maxMarks: string; passMarks: string | null }[] = [];
  for (const id of includeIds) {
    const max = String(formData.get(`max_${id}`) ?? "").trim();
    const pass = String(formData.get(`pass_${id}`) ?? "").trim();
    if (!marksRe.test(max) || Number(max) <= 0) {
      return { status: "error", message: "Enter valid maximum marks for each selected subject." };
    }
    if (pass !== "" && (!marksRe.test(pass) || Number(pass) > Number(max))) {
      return { status: "error", message: "Passing marks must be a number not above the maximum." };
    }
    subjects.push({ subjectId: id, maxMarks: max, passMarks: pass === "" ? null : pass });
  }

  let examId: string;
  try {
    const res = await createExam({ ...parsed.data, subjects });
    examId = res.id;
  } catch (error) {
    if (error instanceof Error) return { status: "error", message: error.message };
    throw error;
  }
  // Redirect throws; it must run outside the try so it isn't swallowed.
  redirect(`/exams/${examId}`);
}

export async function savePaperResultsAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireRole("HEAD", "TEACHER");

  const examSubjectId = String(formData.get("examSubjectId") ?? "");
  if (!examSubjectId) return { status: "error", message: "Missing exam paper." };

  const studentIds = formData.getAll("studentId").map(String).filter(Boolean);
  const entries: ResultEntry[] = studentIds.map((id) => {
    const raw = String(formData.get(`marks_${id}`) ?? "").trim();
    return {
      studentId: id,
      marks: raw === "" ? null : raw,
      isAbsent: formData.get(`absent_${id}`) === "on",
    };
  });

  for (const entry of entries) {
    if (!entry.isAbsent && entry.marks !== null && !marksRe.test(entry.marks)) {
      return { status: "error", message: "Marks must be numbers with up to two decimals." };
    }
  }

  try {
    const { saved } = await savePaperResults({ examSubjectId, entries });
    refresh();
    return { status: "success", message: `Saved ${saved} ${saved === 1 ? "result" : "results"}.` };
  } catch (error) {
    if (error instanceof Error) return { status: "error", message: error.message };
    throw error;
  }
}

export async function setExamPublishedAction(formData: FormData): Promise<void> {
  await requireRole("HEAD");
  const examId = String(formData.get("examId") ?? "");
  const publish = String(formData.get("publish") ?? "") === "1";
  if (examId) {
    await setExamPublished(examId, publish);
    refresh();
  }
}

export async function deleteExamAction(formData: FormData): Promise<void> {
  await requireRole("HEAD");
  const id = String(formData.get("id") ?? "");
  if (id) {
    await deleteExam(id);
    refresh();
  }
}
