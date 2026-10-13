"use server";

import { refresh } from "next/cache";
import { z } from "zod";

import { requireRole } from "@/server/auth/dal";
import {
  saveStaffAttendance,
  type StaffAttendanceEntry,
} from "@/server/academics/staff-attendance";
import type { FormState } from "@/app/staff-attendance/form-state";

const statusSchema = z.enum(["PRESENT", "ABSENT", "LATE", "LEAVE"]);

const metaSchema = z.object({
  // The date input submits "YYYY-MM-DD"; coerce to a Date (UTC midnight).
  date: z.coerce.date(),
});

export async function saveStaffAttendanceAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireRole("HEAD");

  const meta = metaSchema.safeParse({ date: formData.get("date") });
  if (!meta.success) {
    return { status: "error", message: "Pick a valid date." };
  }

  const staffIds = formData.getAll("staffId").map(String);
  const entries: StaffAttendanceEntry[] = [];
  for (const staffId of staffIds) {
    const status = statusSchema.safeParse(formData.get(`status_${staffId}`));
    if (!status.success) {
      return { status: "error", message: "Every staff member needs a valid status." };
    }
    const rawNote = formData.get(`note_${staffId}`);
    entries.push({
      staffId,
      status: status.data,
      note: rawNote ? String(rawNote) : null,
    });
  }

  if (entries.length === 0) {
    return { status: "error", message: "There are no staff members to mark." };
  }

  try {
    const { saved } = await saveStaffAttendance({ date: meta.data.date, entries });
    refresh();
    return {
      status: "success",
      message: `Saved attendance for ${saved} staff ${saved === 1 ? "member" : "members"}.`,
    };
  } catch (error) {
    if (error instanceof Error) {
      return { status: "error", message: error.message };
    }
    throw error;
  }
}
