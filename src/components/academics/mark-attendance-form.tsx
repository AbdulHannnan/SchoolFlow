"use client";

import { useActionState, useState } from "react";
import type { AttendanceStatus } from "@prisma/client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { saveAttendanceAction } from "@/app/attendance/actions";
import { initialFormState } from "@/app/attendance/form-state";

export type RosterEntry = {
  studentId: string;
  name: string;
  rollNumber: string | null;
  section: { id: string; name: string } | null;
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
 * The marking grid: one row per student with a status (defaulting to the day's
 * saved value, else Present) and an optional note. Statuses are controlled so
 * "Mark all present" can set them at once; the whole class saves in one submit.
 */
export function MarkAttendanceForm({
  classId,
  sectionId,
  date,
  className,
  roster,
}: {
  classId: string;
  sectionId: string;
  date: string;
  className: string;
  roster: RosterEntry[];
}) {
  const [state, action, pending] = useActionState(saveAttendanceAction, initialFormState);
  const [statuses, setStatuses] = useState<Record<string, AttendanceStatus>>(() =>
    Object.fromEntries(roster.map((r) => [r.studentId, r.record?.status ?? "PRESENT"])),
  );

  function setAll(value: AttendanceStatus) {
    setStatuses(Object.fromEntries(roster.map((r) => [r.studentId, value])));
  }

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="classId" value={classId} />
      <input type="hidden" name="sectionId" value={sectionId} />
      <input type="hidden" name="date" value={date} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-medium">
          {className}
          <span className="text-muted-foreground ml-2 font-normal">
            {roster.length} {roster.length === 1 ? "student" : "students"} - {date}
          </span>
        </h2>
        <Button type="button" variant="outline" size="sm" onClick={() => setAll("PRESENT")}>
          Mark all present
        </Button>
      </div>

      <ul className="divide-border border-border divide-y rounded-md border">
        {roster.map((entry) => (
          <li
            key={entry.studentId}
            className="grid items-center gap-3 p-3 sm:grid-cols-[1fr_8rem_1fr]"
          >
            <input type="hidden" name="studentId" value={entry.studentId} />
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">
                {entry.name}
                {entry.rollNumber ? (
                  <span className="text-muted-foreground ml-2 font-normal">
                    #{entry.rollNumber}
                  </span>
                ) : null}
              </div>
              {entry.section ? (
                <div className="text-muted-foreground text-xs">{entry.section.name}</div>
              ) : null}
            </div>

            <select
              name={`status_${entry.studentId}`}
              value={statuses[entry.studentId]}
              onChange={(e) =>
                setStatuses((prev) => ({
                  ...prev,
                  [entry.studentId]: e.target.value as AttendanceStatus,
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
              name={`note_${entry.studentId}`}
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
