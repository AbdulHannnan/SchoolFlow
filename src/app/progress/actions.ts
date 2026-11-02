"use server";

import { refresh } from "next/cache";
import { z } from "zod";

import { requireRole } from "@/server/auth/dal";
import { addClassNote, deleteClassNote } from "@/server/academics/class-progress";
import {
  sendClassWeeklyReports,
  sendStudentWeeklyReport,
  type WeeklyReportResult,
} from "@/server/academics/weekly-report";
import type { FormState } from "@/app/progress/form-state";

const classNoteSchema = z.object({
  classId: z.string().min(1, "Pick a class"),
  type: z.enum(["HEAD_VISIT", "GENERAL", "ASSEMBLY", "PARENT_COMMENT"]),
  date: z.coerce.date({ error: "Pick a date" }),
  title: z.string().trim().min(2, "Title is too short").max(120),
  body: z.string().trim().min(1, "Add some detail").max(2000),
});

export async function addClassNoteAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireRole("HEAD");

  const parsed = classNoteSchema.safeParse({
    classId: formData.get("classId"),
    type: formData.get("type"),
    date: formData.get("date"),
    title: formData.get("title"),
    body: formData.get("body"),
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
    await addClassNote(parsed.data);
    refresh();
    return { status: "success", message: "Note logged." };
  } catch (error) {
    if (error instanceof Error) {
      return { status: "error", message: error.message };
    }
    throw error;
  }
}

export async function deleteClassNoteAction(formData: FormData): Promise<void> {
  await requireRole("HEAD");
  const id = String(formData.get("id") ?? "");
  if (id) {
    await deleteClassNote(id);
    refresh();
  }
}

/** Turn a weekly-report send result into a user-facing form message. */
function weeklyReportMessage(r: WeeklyReportResult): FormState {
  if (!r.configured) {
    return {
      status: "error",
      message:
        "Set your school's WhatsApp number first - weekly reports stay off until it is added.",
    };
  }
  if (r.students === 0) {
    return {
      status: "success",
      message:
        r.skipped > 0
          ? `No reports sent: ${r.skipped} student${r.skipped === 1 ? "" : "s"} had no linked parent.`
          : "No students to report on.",
    };
  }
  const extra =
    r.skipped > 0
      ? ` (${r.skipped} student${r.skipped === 1 ? "" : "s"} had no linked parent)`
      : "";
  return {
    status: "success",
    message: `Weekly report (${r.weekLabel}) sent to ${r.reports} parent${
      r.reports === 1 ? "" : "s"
    } for ${r.students} student${r.students === 1 ? "" : "s"}.${extra}`,
  };
}

export async function sendStudentWeeklyReportAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireRole("HEAD");
  const studentId = String(formData.get("studentId") ?? "").trim();
  if (!studentId) return { status: "error", message: "No student selected." };

  try {
    const result = await sendStudentWeeklyReport(studentId);
    refresh();
    return weeklyReportMessage(result);
  } catch (error) {
    if (error instanceof Error) return { status: "error", message: error.message };
    throw error;
  }
}

export async function sendClassWeeklyReportsAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireRole("HEAD");
  const classId = String(formData.get("classId") ?? "").trim();
  if (!classId) return { status: "error", message: "Pick a class." };

  try {
    const result = await sendClassWeeklyReports(classId);
    refresh();
    return weeklyReportMessage(result);
  } catch (error) {
    if (error instanceof Error) return { status: "error", message: error.message };
    throw error;
  }
}
