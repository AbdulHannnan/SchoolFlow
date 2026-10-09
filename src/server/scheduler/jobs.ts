import "server-only";

import { flushDueScheduledNotifications } from "@/server/notifications/scheduled";

/**
 * The scheduler's job registry (Module 4.5).
 *
 * A job is a named cron expression plus an async handler. `startScheduler`
 * (see `./index`) schedules every job here with node-cron. New recurring work
 * — a daily attendance digest, nightly cleanups — adds an entry here and needs
 * no change to the runner.
 */
export interface ScheduledJob {
  /** Stable, unique name, used in logs and as the node-cron task name. */
  name: string;
  /** A standard cron expression, evaluated in the scheduler's timezone. */
  schedule: string;
  /** Overrides the scheduler's default timezone for this job only. */
  timezone?: string;
  /** The work to run on each tick. Throwing is caught and logged by the runner. */
  run: () => Promise<void>;
}

export const JOBS: ScheduledJob[] = [
  {
    // Drains the scheduled-notification outbox: anything whose sendAt has
    // passed is delivered through the notification engine. Running every minute
    // keeps "scheduled for HH:MM" sends accurate to the minute.
    name: "flush-scheduled-notifications",
    schedule: "* * * * *",
    run: async () => {
      const result = await flushDueScheduledNotifications();
      if (result.processed > 0) {
        console.info(
          `[scheduler] flush-scheduled-notifications: processed ${result.processed}, ` +
            `delivered ${result.delivered}, failed ${result.failed}`,
        );
      }
    },
  },
];
