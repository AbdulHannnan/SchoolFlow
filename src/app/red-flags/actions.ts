"use server";

import { refresh } from "next/cache";

import { requireRole } from "@/server/auth/dal";
import { reopenRedFlag, resolveRedFlag, scanRedFlags } from "@/server/academics/red-flags";
import type { FormState } from "@/app/red-flags/form-state";

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
