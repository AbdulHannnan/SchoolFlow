import { z } from "zod";

export const createSchoolSchema = z.object({
  schoolName: z.string().trim().min(2, "School name is too short").max(100),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers, and hyphens"),
  headName: z.string().trim().min(2, "Name is too short").max(100),
  headEmail: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Enter a valid email"),
  headPassword: z.string().min(8, "Use at least 8 characters").max(200),
});
