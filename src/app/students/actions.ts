"use server";

import { refresh } from "next/cache";
import { Prisma } from "@prisma/client";
import { z } from "zod";

import { requireRole } from "@/server/auth/dal";
import { createStudent, deleteStudent, updateStudent } from "@/server/academics/students";
import type { FormState } from "@/app/students/form-state";

const studentSchema = z.object({
  name: z.string().trim().min(2, "Name is too short").max(100),
  rollNumber: z
    .string()
    .trim()
    .max(20)
    .transform((v) => (v === "" ? null : v)),
  fatherName: z
    .string()
    .trim()
    .max(100)
    .transform((v) => (v === "" ? null : v)),
  // CNIC: 13 digits, with or without dashes; stored normalized (digits only).
  fatherCnic: z
    .string()
    .trim()
    .transform((v) => v.replace(/[\s-]/g, ""))
    .refine((v) => v === "" || /^\d{13}$/.test(v), "CNIC must be 13 digits")
    .transform((v) => (v === "" ? null : v)),
  classId: z.string().min(1, "Pick a class"),
  sectionId: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : v)),
  gender: z
    .enum(["MALE", "FEMALE", "OTHER"])
    .or(z.literal(""))
    .transform((v) => (v === "" ? null : v)),
  dateOfBirth: z.union([z.literal(""), z.coerce.date()]).transform((v) => (v === "" ? null : v)),
  admissionDate: z.union([z.literal(""), z.coerce.date()]).transform((v) => (v === "" ? null : v)),
});

export async function createStudentAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireRole("HEAD");

  const parsed = studentSchema.safeParse({
    name: formData.get("name"),
    rollNumber: formData.get("rollNumber") ?? "",
    fatherName: formData.get("fatherName") ?? "",
    fatherCnic: formData.get("fatherCnic") ?? "",
    classId: formData.get("classId"),
    sectionId: formData.get("sectionId") ?? "",
    gender: formData.get("gender") ?? "",
    dateOfBirth: formData.get("dateOfBirth") ?? "",
    admissionDate: formData.get("admissionDate") ?? "",
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
    await createStudent(parsed.data);
    refresh();
    return { status: "success", message: "Student added." };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return {
        status: "error",
        message: "A student with that roll number already exists in this class.",
        fieldErrors: { rollNumber: "Already in use" },
      };
    }
    if (error instanceof Error && error.message.includes("Section")) {
      return { status: "error", message: error.message, fieldErrors: { sectionId: "Invalid" } };
    }
    throw error;
  }
}

const updateStudentSchema = studentSchema.extend({
  id: z.string().min(1, "Missing student"),
});

export async function updateStudentAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireRole("HEAD");

  const parsed = updateStudentSchema.safeParse({
    id: formData.get("id"),
    name: formData.get("name"),
    rollNumber: formData.get("rollNumber") ?? "",
    fatherName: formData.get("fatherName") ?? "",
    fatherCnic: formData.get("fatherCnic") ?? "",
    classId: formData.get("classId"),
    sectionId: formData.get("sectionId") ?? "",
    gender: formData.get("gender") ?? "",
    dateOfBirth: formData.get("dateOfBirth") ?? "",
    admissionDate: formData.get("admissionDate") ?? "",
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      fieldErrors[key] ??= issue.message;
    }
    return { status: "error", message: "Please fix the errors.", fieldErrors };
  }

  // Enrolled status: a checkbox is present ("on") only when checked.
  const isActive = formData.get("isActive") === "on";

  try {
    await updateStudent({ ...parsed.data, isActive });
    refresh();
    return { status: "success", message: "Student updated." };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return {
        status: "error",
        message: "A student with that roll number already exists in this class.",
        fieldErrors: { rollNumber: "Already in use" },
      };
    }
    if (error instanceof Error && error.message.includes("Section")) {
      return { status: "error", message: error.message, fieldErrors: { sectionId: "Invalid" } };
    }
    if (error instanceof Error) {
      return { status: "error", message: error.message };
    }
    throw error;
  }
}

export async function deleteStudentAction(formData: FormData): Promise<void> {
  await requireRole("HEAD");
  const id = String(formData.get("id") ?? "");
  if (id) {
    await deleteStudent(id);
    refresh();
  }
}
