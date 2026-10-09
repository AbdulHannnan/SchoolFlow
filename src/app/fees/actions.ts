"use server";

import { refresh } from "next/cache";
import { Prisma } from "@prisma/client";
import { z } from "zod";

import { requireRole } from "@/server/auth/dal";
import {
  createFeeCategory,
  createFeeStructure,
  deleteFeeCategory,
  deleteFeeStructure,
} from "@/server/fees/structure";
import type { FormState } from "@/app/fees/form-state";

function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    out[key] ??= issue.message;
  }
  return out;
}

const categorySchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(60),
});

const structureSchema = z.object({
  categoryId: z.string().min(1, "Pick a category"),
  classId: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : v)),
  label: z
    .string()
    .trim()
    .max(80)
    .transform((v) => (v === "" ? null : v)),
  // Validate as a string to keep the exact 2-decimal scale (no float rounding).
  amount: z
    .string()
    .trim()
    .regex(/^\d+(\.\d{1,2})?$/, "Enter a valid amount (e.g. 1500 or 1500.50)")
    .refine((v) => Number(v) > 0, "Amount must be greater than zero"),
  frequency: z.enum(["MONTHLY", "QUARTERLY", "ANNUAL", "ONE_TIME"]),
});

export async function createFeeCategoryAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireRole("HEAD");

  const parsed = categorySchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the errors.",
      fieldErrors: fieldErrors(parsed.error),
    };
  }

  try {
    await createFeeCategory(parsed.data);
    refresh();
    return { status: "success", message: "Category added." };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return {
        status: "error",
        message: "That category already exists.",
        fieldErrors: { name: "Already exists" },
      };
    }
    throw error;
  }
}

export async function deleteFeeCategoryAction(formData: FormData): Promise<void> {
  await requireRole("HEAD");
  const id = String(formData.get("id") ?? "");
  if (id) {
    await deleteFeeCategory(id);
    refresh();
  }
}

export async function createFeeStructureAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireRole("HEAD");

  const parsed = structureSchema.safeParse({
    categoryId: formData.get("categoryId"),
    classId: formData.get("classId") ?? "",
    label: formData.get("label") ?? "",
    amount: formData.get("amount") ?? "",
    frequency: formData.get("frequency"),
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the errors.",
      fieldErrors: fieldErrors(parsed.error),
    };
  }

  try {
    await createFeeStructure(parsed.data);
    refresh();
    return { status: "success", message: "Fee added." };
  } catch (error) {
    if (error instanceof Error) {
      return { status: "error", message: error.message };
    }
    throw error;
  }
}

export async function deleteFeeStructureAction(formData: FormData): Promise<void> {
  await requireRole("HEAD");
  const id = String(formData.get("id") ?? "");
  if (id) {
    await deleteFeeStructure(id);
    refresh();
  }
}
