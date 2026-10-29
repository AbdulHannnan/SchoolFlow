"use server";

import { refresh } from "next/cache";
import { z } from "zod";

import { requireRole } from "@/server/auth/dal";
import {
  raiseBehaviorFlag,
  reopenRedFlag,
  resolveRedFlag,
  scanRedFlags,
} from "@/server/academics/red-flags";
import type { FormState } from "@/app/red-flags/form-state";

const behaviorSchema = z.object({
  studentId: z.string().min(1, "Select a student"),
  title: z.string().trim().min(1, "A short title is required").max(100),
  detail: z.string().trim().min(1, "Describe what happened").max(500),
});

function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    out[key] ??= issue.message;
  }
  return out;
}

export async function scanRedFlagsAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireRole("HEAD");

  const classId = String(formData.get("classId") ?? "").trim() || null;
  const monthRaw = String(formData.get("month") ?? "").trim();
  const month = /^\d{4}-\d{2}$/.test(monthRaw) ? monthRaw : null;

  try {
    const { raised, refreshed, month: scanned } = await scanRedFlags({ classId, month });
    refresh();
    const parts = [`${raised} new ${raised === 1 ? "flag" : "flags"}`, `${refreshed} refreshed`];
    return { status: "success", message: `Scan of ${scanned}: ${parts.join(", ")}.` };
  } catch (error) {
    if (error instanceof Error) return { status: "error", message: error.message };
    throw error;
  }
}

export async function raiseBehaviorFlagAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  // A teacher reports conduct for a student in their class; HEAD may also use it.
  await requireRole("TEACHER", "HEAD");

  const parsed = behaviorSchema.safeParse({
    studentId: formData.get("studentId"),
    title: formData.get("title"),
    detail: formData.get("detail"),
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the errors.",
      fieldErrors: fieldErrors(parsed.error),
    };
  }

  try {
    await raiseBehaviorFlag(parsed.data);
    refresh();
    return { status: "success", message: "Red flag raised. The head office has been notified." };
  } catch (error) {
    if (error instanceof Error) return { status: "error", message: error.message };
    throw error;
  }
}

export async function resolveRedFlagAction(formData: FormData): Promise<void> {
  await requireRole("HEAD");
  const id = String(formData.get("id") ?? "");
  if (id) {
    await resolveRedFlag(id);
    refresh();
  }
}

export async function reopenRedFlagAction(formData: FormData): Promise<void> {
  await requireRole("HEAD");
  const id = String(formData.get("id") ?? "");
  if (id) {
    await reopenRedFlag(id);
    refresh();
  }
}
