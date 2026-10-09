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
import { generateInvoices } from "@/server/fees/invoices";
import {
  recordPayment,
  rejectPayment,
  submitBankTransfer,
  verifyPayment,
} from "@/server/fees/payments";
import type { FormState } from "@/app/fees/form-state";

const amountField = z
  .string()
  .trim()
  .regex(/^\d+(\.\d{1,2})?$/, "Enter a valid amount (e.g. 1500 or 1500.50)")
  .refine((v) => Number(v) > 0, "Amount must be greater than zero");

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

const generateSchema = z.object({
  classId: z.string().min(1, "Pick a class"),
  sectionId: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : v)),
  period: z.string().regex(/^\d{4}-\d{2}$/, "Pick a month"),
  dueDate: z.coerce.date().nullable(),
});

export async function generateInvoicesAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireRole("HEAD");

  const rawDue = String(formData.get("dueDate") ?? "").trim();
  const parsed = generateSchema.safeParse({
    classId: formData.get("classId"),
    sectionId: formData.get("sectionId") ?? "",
    period: formData.get("period"),
    dueDate: rawDue === "" ? null : rawDue,
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the errors.",
      fieldErrors: fieldErrors(parsed.error),
    };
  }

  try {
    const { created, skipped, feeCount } = await generateInvoices(parsed.data);
    refresh();
    if (feeCount === 0) {
      return {
        status: "error",
        message: "No active monthly fees apply to this class. Add a fee first.",
      };
    }
    const parts = [`${created} created`];
    if (skipped > 0) parts.push(`${skipped} already existed`);
    return { status: "success", message: `Invoices: ${parts.join(", ")}.` };
  } catch (error) {
    if (error instanceof Error) {
      return { status: "error", message: error.message };
    }
    throw error;
  }
}

const recordPaymentSchema = z.object({
  invoiceId: z.string().min(1),
  amount: amountField,
  method: z.enum(["CASH", "BANK_TRANSFER", "CARD", "OTHER"]),
  reference: z
    .string()
    .trim()
    .max(120)
    .transform((v) => (v === "" ? null : v)),
  note: z
    .string()
    .trim()
    .max(200)
    .transform((v) => (v === "" ? null : v)),
});

export async function recordPaymentAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireRole("HEAD");

  const parsed = recordPaymentSchema.safeParse({
    invoiceId: formData.get("invoiceId"),
    amount: formData.get("amount") ?? "",
    method: formData.get("method"),
    reference: formData.get("reference") ?? "",
    note: formData.get("note") ?? "",
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the errors.",
      fieldErrors: fieldErrors(parsed.error),
    };
  }

  try {
    await recordPayment(parsed.data);
    refresh();
    return { status: "success", message: "Payment recorded." };
  } catch (error) {
    if (error instanceof Error) return { status: "error", message: error.message };
    throw error;
  }
}

const bankTransferSchema = z.object({
  invoiceId: z.string().min(1),
  amount: amountField,
  reference: z.string().trim().min(1, "Enter the transfer reference").max(120),
  note: z
    .string()
    .trim()
    .max(200)
    .transform((v) => (v === "" ? null : v)),
});

export async function submitBankTransferAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireRole("PARENT");

  const parsed = bankTransferSchema.safeParse({
    invoiceId: formData.get("invoiceId"),
    amount: formData.get("amount") ?? "",
    reference: formData.get("reference") ?? "",
    note: formData.get("note") ?? "",
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the errors.",
      fieldErrors: fieldErrors(parsed.error),
    };
  }

  try {
    await submitBankTransfer(parsed.data);
    refresh();
    return { status: "success", message: "Submitted. The school will verify it." };
  } catch (error) {
    if (error instanceof Error) return { status: "error", message: error.message };
    throw error;
  }
}

export async function verifyPaymentAction(formData: FormData): Promise<void> {
  await requireRole("HEAD");
  const id = String(formData.get("id") ?? "");
  if (id) {
    await verifyPayment(id);
    refresh();
  }
}

export async function rejectPaymentAction(formData: FormData): Promise<void> {
  await requireRole("HEAD");
  const id = String(formData.get("id") ?? "");
  if (id) {
    await rejectPayment(id);
    refresh();
  }
}
