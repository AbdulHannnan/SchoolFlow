"use client";

import { useActionState, useState } from "react";
import type { AttendanceStatus } from "@prisma/client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { saveStaffAttendanceAction } from "@/app/staff-attendance/actions";
import { initialFormState } from "@/app/staff-attendance/form-state";

export type StaffRosterEntry = {
  staffId: string;
  name: string;
  email: string;
  mainSubject: string | null;
  record: { id: string; status: AttendanceStatus; note: string | null } | null;
};

const STATUSES: { value: AttendanceStatus; label: string }[] = [
  { value: "PRESENT", label: "Present" },
  { value: "ABSENT", label: "Absent" },
  { value: "LATE", label: "Late" },
  { value: "LEAVE", label: "Leave" },
];

const selectClass = cn(
  "border-input dark:bg-input/30 h-9 w-full rounded-md border bg-transparent px-2 text-sm shadow-xs outline-none",
  "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
);

/**
 * The staff marking grid: one row per teacher with a status (defaulting to the
 * day's saved value, else Present) and an optional note. Statuses are controlled
 * so "Mark all present" can set them at once; the whole list saves in one submit.
 */
export function MarkStaffAttendanceForm({
  date,
  roster,
}: {
  date: string;
  roster: StaffRosterEntry[];
}) {
  const [state, action, pending] = useActionState(saveStaffAttendanceAction, initialFormState);
  const [statuses, setStatuses] = useState<Record<string, AttendanceStatus>>(() =>
    Object.fromEntries(roster.map((r) => [r.staffId, r.record?.status ?? "PRESENT"])),
  );

  function setAll(value: AttendanceStatus) {
    setStatuses(Object.fromEntries(roster.map((r) => [r.staffId, value])));
  }

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="date" value={date} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-medium">
          Staff
          <span className="text-muted-foreground ml-2 font-normal">
            {roster.length} {roster.length === 1 ? "member" : "members"} - {date}
          </span>
        </h2>
        <Button type="button" variant="outline" size="sm" onClick={() => setAll("PRESENT")}>
          Mark all present
        </Button>
      </div>

      <ul className="divide-border border-border divide-y rounded-md border">
        {roster.map((entry) => (
          <li
            key={entry.staffId}
            className="grid items-center gap-3 p-3 sm:grid-cols-[1fr_8rem_1fr]"
          >
            <input type="hidden" name="staffId" value={entry.staffId} />
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">{entry.name}</div>
              <div className="text-muted-foreground truncate text-xs">
                {entry.mainSubject ?? entry.email}
              </div>
            </div>

            <select
              name={`status_${entry.staffId}`}
              value={statuses[entry.staffId]}
              onChange={(e) =>
                setStatuses((prev) => ({
                  ...prev,
                  [entry.staffId]: e.target.value as AttendanceStatus,
                }))
              }
              className={selectClass}
              aria-label={`Status for ${entry.name}`}
            >
              {STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>

            <Input
              name={`note_${entry.staffId}`}
              defaultValue={entry.record?.note ?? ""}
              placeholder="Note (optional)"
              aria-label={`Note for ${entry.name}`}
            />
          </li>
        ))}
      </ul>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving..." : "Save attendance"}
        </Button>
        {state.status === "success" && state.message ? (
          <span className="text-sm text-green-600 dark:text-green-500">{state.message}</span>
        ) : null}
        {state.status === "error" && state.message ? (
          <span className="text-destructive text-sm">{state.message}</span>
        ) : null}
      </div>
    </form>
  );
}
