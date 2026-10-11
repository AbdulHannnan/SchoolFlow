"use client";

import { useActionState, useEffect, useRef } from "react";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { addTimetableEntryAction } from "@/app/teachers/actions";
import { initialFormState } from "@/app/teachers/form-state";
import { WEEKDAYS, WEEKDAY_LABELS } from "@/lib/timetable";

type Option = { id: string; name: string };

const selectClass =
  "border-input dark:bg-input/30 h-9 w-full rounded-md border bg-transparent px-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]";

export function AddTimetableForm({
  teacherId,
  teachers,
  subjects,
  classes,
}: {
  // Fixed teacher (per-teacher page) OR a teacher picker (all-teachers page).
  teacherId?: string;
  teachers?: Option[];
  subjects: Option[];
  classes: Option[];
}) {
  const [state, action, pending] = useActionState(addTimetableEntryAction, initialFormState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === "success") formRef.current?.reset();
  }, [state]);

  return (
    <form
      ref={formRef}
      action={action}
      className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6 lg:items-end"
    >
      {teachers ? (
        <div className="space-y-2">
          <Label htmlFor="tt-teacher">Teacher</Label>
          <select id="tt-teacher" name="teacherId" defaultValue="" required className={selectClass}>
            <option value="" disabled>
              Select...
            </option>
            {teachers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <input type="hidden" name="teacherId" value={teacherId} />
      )}

      <div className="space-y-2">
        <Label htmlFor="tt-day">Day</Label>
        <select id="tt-day" name="day" defaultValue="MON" className={selectClass}>
          {WEEKDAYS.map((d) => (
            <option key={d} value={d}>
              {WEEKDAY_LABELS[d]}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="tt-period">Period</Label>
        <Input
          id="tt-period"
          name="period"
          type="number"
          min={1}
          max={20}
          defaultValue={1}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="tt-subject">Subject</Label>
        <select id="tt-subject" name="subjectId" defaultValue="" required className={selectClass}>
          <option value="" disabled>
            Select...
          </option>
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="tt-class">Class</Label>
        <select id="tt-class" name="classId" defaultValue="" required className={selectClass}>
          <option value="" disabled>
            Select...
          </option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <Button type="submit" disabled={pending} className="w-full">
          <Plus className="size-4" />
          {pending ? "Adding..." : "Add"}
        </Button>
      </div>

      {state.status === "error" && state.message ? (
        <p role="alert" className="text-destructive col-span-full text-sm">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
