import "server-only";

import cron, { type ScheduledTask } from "node-cron";

import { JOBS } from "@/server/scheduler/jobs";

/**
 * Scheduler runtime (Module 4.5).
 *
 * `startScheduler` is called once at server boot from `src/instrumentation.ts`
 * and registers every job in the registry with node-cron. It is:
 *
 *   - Node-only: it returns early on the Edge runtime and during the production
 *     build, where long-lived timers have no place.
 *   - Idempotent: the task list is cached on `globalThis`, so dev hot-reloads
 *     (or a double `register`) never stack duplicate cron tasks.
 *   - Gated: off unless `SCHEDULER_ENABLED` is truthy, except in production
 *     where it defaults on. This keeps background sends from firing in every
 *     local `next dev` unless you opt in.
 *
 * Each job runs with `noOverlap`, so a slow tick never overlaps its next one,
 * and in its own try/catch, so one job throwing never tears down the others.
 */

const DEFAULT_TIMEZONE = "Asia/Karachi";

const globalForScheduler = globalThis as unknown as {
  schedulerTasks: ScheduledTask[] | undefined;
};

/** Whether the scheduler should run in this environment. */
function schedulingEnabled(): boolean {
  const flag = process.env.SCHEDULER_ENABLED;
  if (flag != null && flag !== "") return flag === "true" || flag === "1";
  return process.env.NODE_ENV === "production";
}

export function startScheduler(): void {
  // Only the Node.js server runtime — never Edge, never the build.
  if (process.env.NEXT_RUNTIME && process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;

  // Idempotent across dev HMR / repeated registration.
  if (globalForScheduler.schedulerTasks) return;

  if (!schedulingEnabled()) {
    globalForScheduler.schedulerTasks = [];
    console.info("[scheduler] disabled (set SCHEDULER_ENABLED=true to run it here)");
    return;
  }

  const defaultTimezone = process.env.SCHEDULER_TIMEZONE || DEFAULT_TIMEZONE;
  const tasks: ScheduledTask[] = [];

  for (const job of JOBS) {
    if (!cron.validate(job.schedule)) {
      console.error(`[scheduler] skipping "${job.name}": invalid cron "${job.schedule}"`);
      continue;
    }

    const timezone = job.timezone ?? defaultTimezone;
    const task = cron.schedule(
      job.schedule,
      async () => {
        try {
          await job.run();
        } catch (err) {
          console.error(`[scheduler] job "${job.name}" threw`, err);
        }
      },
      { name: job.name, timezone, noOverlap: true },
    );
    tasks.push(task);
    console.info(`[scheduler] scheduled "${job.name}" (${job.schedule}, ${timezone})`);
  }

  globalForScheduler.schedulerTasks = tasks;
  console.info(`[scheduler] started with ${tasks.length} job(s)`);
}

/** Stop and clear every scheduled task. */
export function stopScheduler(): void {
  const tasks = globalForScheduler.schedulerTasks;
  if (!tasks) return;
  for (const task of tasks) void task.stop();
  globalForScheduler.schedulerTasks = undefined;
}
