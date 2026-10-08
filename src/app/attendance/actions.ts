"use server";

import { refresh } from "next/cache";
import { z } from "zod";

import { requireRole } from "@/server/auth/dal";
import { saveClassAttendance, type AttendanceEntry } from "@/server/academics/attendance";
import type { FormState } from "@/app/attendance/form-state";

const statusSchema = z.enum(["PRESENT", "ABSENT", "LATE", "LEAVE"]);

const metaSchema = z.object({
  classId: z.string().min(1, "Pick a class"),
  sectionId: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : v)),
  // The date input submits "YYYY-MM-DD"; coerce to a Date (UTC midnight).
  date: z.coerce.date(),
});

export async function saveAttendanceAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireRole("TEACHER", "HEAD");

  const meta = metaSchema.safeParse({
    classId: formData.get("classId"),
    sectionId: formData.get("sectionId") ?? "",
    date: formData.get("date"),
  });
  if (!meta.success) {
    return { status: "error", message: "Pick a class and a valid date." };
  }

  const studentIds = formData.getAll("studentId").map(String);
  const entries: AttendanceEntry[] = [];
  for (const studentId of studentIds) {
    const status = statusSchema.safeParse(formData.get(`status_${studentId}`));
    if (!status.success) {
      return { status: "error", message: "Every student needs a valid status." };
    }
    const rawNote = formData.get(`note_${studentId}`);
    entries.push({
      studentId,
      status: status.data,
      note: rawNote ? String(rawNote) : null,
    });
  }

  if (entries.length === 0) {
    return { status: "error", message: "There are no students to mark." };
  }

  try {
    const { saved } = await saveClassAttendance({
      classId: meta.data.classId,
      sectionId: meta.data.sectionId,
      date: meta.data.date,
      entries,
    });
    refresh();
    return {
      status: "success",
      message: `Saved attendance for ${saved} ${saved === 1 ? "student" : "students"}.`,
    };
  } catch (error) {
    if (error instanceof Error) {
      return { status: "error", message: error.message };
    }
    throw error;
  }
}
