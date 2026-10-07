/**
 * Shared, framework-agnostic helpers usable on both client and server.
 * Keep anything that touches secrets, the database, or Node-only APIs in
 * `src/server/` instead.
 */
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merge class names conditionally, resolving conflicting Tailwind utilities so
 * the last one wins (e.g. `cn("p-2", "p-4")` → `"p-4"`). Used by shadcn/ui
 * components and anywhere we compose Tailwind classes.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** Pause for the given number of milliseconds. */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
