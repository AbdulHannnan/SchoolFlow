/**
 * Server instrumentation (Next.js `register` hook).
 *
 * Runs once when a Node.js server instance starts, before it serves requests.
 * We use it to boot the node-cron scheduler (Module 4.5). The scheduler and its
 * dependencies (Prisma, `server-only`) are pulled in with a dynamic import so
 * they are never bundled into the Edge runtime: `register` also runs there, and
 * the guard below returns before importing anything Node-only.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { startScheduler } = await import("@/server/scheduler");
  startScheduler();
}
