import type { z } from "zod";
import type { createSchoolSchema } from "@/app/admin/schema";

/** Shared form state for the create-school Server Action. Kept out of the
 * `"use server"` module, which may only export async functions. */
export type CreateSchoolState = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Partial<Record<keyof z.infer<typeof createSchoolSchema>, string>>;
  createdSlug?: string;
};

export const initialCreateSchoolState: CreateSchoolState = { status: "idle" };
