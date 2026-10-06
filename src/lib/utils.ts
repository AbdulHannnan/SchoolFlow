/**
 * Shared, framework-agnostic helpers usable on both client and server.
 * Keep anything that touches secrets, the database, or Node-only APIs in
 * `src/server/` instead.
 */

/** Pause for the given number of milliseconds. */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
