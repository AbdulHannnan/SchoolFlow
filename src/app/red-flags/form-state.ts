/** Shared form state for the red-flag Server Actions (kept out of the
 * `"use server"` module, which may only export async functions). */
export type FormState = {
  status: "idle" | "success" | "error";
  message?: string;
};

export const initialFormState: FormState = { status: "idle" };
