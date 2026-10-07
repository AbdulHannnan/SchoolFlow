/** Shared form state for the classes/sections Server Actions. Kept out of the
 * `"use server"` module, which may only export async functions. */
export type FormState = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Record<string, string>;
};

export const initialFormState: FormState = { status: "idle" };
