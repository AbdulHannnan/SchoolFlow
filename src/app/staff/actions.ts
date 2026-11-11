"use server";

import { refresh } from "next/cache";
import { z } from "zod";

import { requireRole } from "@/server/auth/dal";
import { createStaff, deleteStaff, updateStaff } from "@/server/academics/staff";
import type { FormState } from "@/app/staff/form-state";

const staffSchema = z
  .object({
    name: z.string().trim().min(2, "Name is too short").max(100),
    role: z.enum([
      "DRIVER",
      "GARDENER",
      "MAID",
      "CLERK",
      "GUARD",
      "COOK",
      "SWEEPER",
      "PEON",
      "ACCOUNTANT",
      "OTHER",
    ]),
    customRole: z
      .string()
      .trim()
      .max(60)
      .transform((v) => (v === "" ? null : v)),
    // Phone: digits only (strip spaces/dashes/+); optional.
    phone: z
      .string()
      .trim()
      .transform((v) => v.replace(/[\s-+]/g, ""))
      .refine((v) => v === "" || /^\d{7,15}$/.test(v), "Enter a valid phone number")
      .transform((v) => (v === "" ? null : v)),
    // CNIC: 13 digits, with or without dashes; stored normalized (digits only).
    cnic: z
      .string()
      .trim()
      .transform((v) => v.replace(/[\s-]/g, ""))
      .refine((v) => v === "" || /^\d{13}$/.test(v), "CNIC must be 13 digits")
      .transform((v) => (v === "" ? null : v)),
    address: z
      .string()
      .trim()
      .max(200)
      .transform((v) => (v === "" ? null : v)),
    joiningDate: z.union([z.literal(""), z.coerce.date()]).transform((v) => (v === "" ? null : v)),
    // Salary: a non-negative amount with up to 2 decimals; stored as a string.
    monthlySalary: z
      .string()
      .trim()
      .refine(
        (v) => v === "" || (/^\d+(\.\d{1,2})?$/.test(v) && Number(v) >= 0),
        "Enter a valid amount",
      )
      .transform((v) => (v === "" ? null : v)),
  })
  .refine((data) => data.role !== "OTHER" || data.customRole != null, {
    message: "Describe the role",
    path: ["customRole"],
  });

function fieldErrorsOf(error: z.ZodError): Record<string, string> {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    fieldErrors[key] ??= issue.message;
  }
  return fieldErrors;
}

function readStaffForm(formData: FormData) {
  return {
    name: formData.get("name"),
    role: formData.get("role"),
    customRole: formData.get("customRole") ?? "",
    phone: formData.get("phone") ?? "",
    cnic: formData.get("cnic") ?? "",
    address: formData.get("address") ?? "",
    joiningDate: formData.get("joiningDate") ?? "",
    monthlySalary: formData.get("monthlySalary") ?? "",
  };
}

export async function createStaffAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireRole("HEAD");

  const parsed = staffSchema.safeParse(readStaffForm(formData));
  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the errors.",
      fieldErrors: fieldErrorsOf(parsed.error),
    };
  }

  await createStaff(parsed.data);
  refresh();
  return { status: "success", message: "Staff member added." };
}

export async function updateStaffAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireRole("HEAD");

  const id = String(formData.get("id") ?? "");
  if (!id) {
    return { status: "error", message: "Missing staff member." };
  }

  const parsed = staffSchema.safeParse(readStaffForm(formData));
  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the errors.",
      fieldErrors: fieldErrorsOf(parsed.error),
    };
  }

  // Active status: a checkbox is present ("on") only when checked.
  const isActive = formData.get("isActive") === "on";

  try {
    await updateStaff({ ...parsed.data, id, isActive });
    refresh();
    return { status: "success", message: "Staff member updated." };
  } catch (error) {
    if (error instanceof Error) {
      return { status: "error", message: error.message };
    }
    throw error;
  }
}

export async function deleteStaffAction(formData: FormData): Promise<void> {
  await requireRole("HEAD");
  const id = String(formData.get("id") ?? "");
  if (id) {
    await deleteStaff(id);
    refresh();
  }
}
