"use server";

import { refresh } from "next/cache";
import { z } from "zod";

import { requireRole } from "@/server/auth/dal";
import { createMeeting, deleteMeeting } from "@/server/academics/meetings";
import type { FormState } from "@/app/meetings/form-state";

const meetingSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(140),
  agenda: z
    .string()
    .trim()
    .max(4000)
    .transform((v) => (v === "" ? null : v)),
  location: z
    .string()
    .trim()
    .max(200)
    .transform((v) => (v === "" ? null : v)),
  // The datetime-local input submits "YYYY-MM-DDTHH:mm"; coerce to a Date.
  scheduledAt: z.coerce.date(),
});

export async function createMeetingAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireRole("HEAD");

  const parsed = meetingSchema.safeParse({
    title: formData.get("title"),
    agenda: formData.get("agenda") ?? "",
    location: formData.get("location") ?? "",
    scheduledAt: formData.get("scheduledAt"),
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      fieldErrors[key] ??= issue.message;
    }
    return { status: "error", message: "Please fix the errors.", fieldErrors };
  }

  const teacherIds = formData.getAll("teacherId").map(String);
  if (teacherIds.length === 0) {
    return {
      status: "error",
      message: "Pick at least one teacher to invite.",
      fieldErrors: { teacherId: "Select at least one teacher." },
    };
  }

  try {
    const { invited } = await createMeeting({ ...parsed.data, teacherIds });
    refresh();
    return {
      status: "success",
      message: `Meeting scheduled. ${invited} ${invited === 1 ? "teacher" : "teachers"} notified.`,
    };
  } catch (error) {
    if (error instanceof Error) {
      return { status: "error", message: error.message };
    }
    throw error;
  }
}

export async function deleteMeetingAction(formData: FormData): Promise<void> {
  await requireRole("HEAD");
  const id = String(formData.get("id") ?? "");
  if (id) {
    await deleteMeeting(id);
    refresh();
  }
}
