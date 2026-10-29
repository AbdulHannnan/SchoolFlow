/** Shared form state for the red-flag Server Actions (kept out of the
 * `"use server"` module, which may only export async functions). */
export type FormState = {
  status: "idle" | "success" | "error";
  message?: string;
  /** Per-field validation messages (used by the behaviour-flag form). */
  fieldErrors?: Record<string, string>;
};

export const initialFormState: FormState = { status: "idle" };
