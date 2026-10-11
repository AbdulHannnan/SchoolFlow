"use server";

import { refresh } from "next/cache";
import { Prisma } from "@prisma/client";
import { z } from "zod";

import { requireRole } from "@/server/auth/dal";
import {
  createTeacher,
  deleteTeacher,
  createAssignment,
  deleteAssignment,
  addTimetableEntry,
  deleteTimetableEntry,
} from "@/server/academics/teachers";
import type { FormState } from "@/app/teachers/form-state";

const teacherSchema = z.object({
  name: z.string().trim().min(2, "Name is too short").max(100),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Enter a valid email"),
  password: z.string().min(8, "Use at least 8 characters").max(200),
  mainSubjectId: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : v)),
});

const assignmentSchema = z.object({
  teacherId: z.string().min(1),
  subjectId: z.string().min(1, "Pick a subject"),
  classId: z.string().min(1, "Pick a class"),
});

function toFieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    out[key] ??= issue.message;
  }
  return out;
}

export async function createTeacherAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireRole("HEAD");

  const parsed = teacherSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    mainSubjectId: formData.get("mainSubjectId") ?? "",
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the errors.",
      fieldErrors: toFieldErrors(parsed.error),
    };
  }

  try {
    await createTeacher(parsed.data);
    refresh();
    return { status: "success", message: "Teacher added." };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return {
        status: "error",
        message: "A user with that email already exists in this school.",
        fieldErrors: { email: "Already in use" },
      };
    }
    if (error instanceof Error) {
      return { status: "error", message: error.message };
    }
    throw error;
  }
}

export async function createAssignmentAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireRole("HEAD");

  const parsed = assignmentSchema.safeParse({
    teacherId: formData.get("teacherId"),
    subjectId: formData.get("subjectId"),
    classId: formData.get("classId"),
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the errors.",
      fieldErrors: toFieldErrors(parsed.error),
    };
  }

  try {
    await createAssignment(parsed.data);
    refresh();
    return { status: "success", message: "Assignment added." };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { status: "error", message: "That assignment already exists." };
    }
    throw error;
  }
}

const timetableSchema = z.object({
  teacherId: z.string().min(1),
  classId: z.string().min(1, "Pick a class"),
  subjectId: z.string().min(1, "Pick a subject"),
  day: z.enum(["MON", "TUE", "WED", "THU", "FRI", "SAT"]),
  period: z.coerce.number().int().min(1, "Period must be 1 or more").max(20),
});

export async function addTimetableEntryAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireRole("HEAD");

  const parsed = timetableSchema.safeParse({
    teacherId: formData.get("teacherId"),
    classId: formData.get("classId"),
    subjectId: formData.get("subjectId"),
    day: formData.get("day"),
    period: formData.get("period"),
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the errors.",
      fieldErrors: toFieldErrors(parsed.error),
    };
  }

  try {
    await addTimetableEntry(parsed.data);
    refresh();
    return { status: "success", message: "Timetable entry added." };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return {
        status: "error",
        message: "This teacher already has a class in that day and period.",
      };
    }
    if (error instanceof Error) {
      return { status: "error", message: error.message };
    }
    throw error;
  }
}

export async function deleteTimetableEntryAction(formData: FormData): Promise<void> {
  await requireRole("HEAD");
  const id = String(formData.get("id") ?? "");
  if (id) {
    await deleteTimetableEntry(id);
    refresh();
  }
}

export async function deleteTeacherAction(formData: FormData): Promise<void> {
  await requireRole("HEAD");
  const id = String(formData.get("id") ?? "");
  if (id) {
    await deleteTeacher(id);
    refresh();
  }
}

export async function deleteAssignmentAction(formData: FormData): Promise<void> {
  await requireRole("HEAD");
  const id = String(formData.get("id") ?? "");
  if (id) {
    await deleteAssignment(id);
    refresh();
  }
}
