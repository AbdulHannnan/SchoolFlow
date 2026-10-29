"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { raiseBehaviorFlagAction } from "@/app/red-flags/actions";
import { initialFormState } from "@/app/red-flags/form-state";
import type { FlaggableClass } from "@/server/academics/red-flags";

const selectClass = cn(
  "border-input dark:bg-input/30 h-9 w-full rounded-md border bg-transparent px-2 text-sm shadow-xs outline-none",
  "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
  "disabled:cursor-not-allowed disabled:opacity-50",
);

/**
 * Raises a manual behaviour red flag against a student (teacher/head). The
 * class picker drives the student list client-side; on success the fields reset
 * so several can be reported in a row.
 */
export function RaiseBehaviorFlagForm({ classes }: { classes: FlaggableClass[] }) {
  const [state, action, pending] = useActionState(raiseBehaviorFlagAction, initialFormState);
  const formRef = useRef<HTMLFormElement>(null);
  const [classId, setClassId] = useState("");
  const errors = state.fieldErrors ?? {};

  useEffect(() => {
    // Clear the student/title/detail fields; keep the class selected so a
    // teacher can report several students in the same class in a row.
    if (state.status === "success") formRef.current?.reset();
  }, [state]);

  const students = classes.find((c) => c.id === classId)?.students ?? [];

  return (
    <form ref={formRef} action={action} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="flag-class">Class</Label>
          <select
            id="flag-class"
            value={classId}
            onChange={(e) => setClassId(e.target.value)}
            className={selectClass}
            required
          >
            <option value="" disabled>
              Select class...
            </option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="flag-student">Student</Label>
          <select
            id="flag-student"
            name="studentId"
            defaultValue=""
            key={classId /* reset the choice when the class changes */}
            className={selectClass}
            required
            disabled={!classId}
            aria-invalid={!!errors.studentId}
          >
            <option value="" disabled>
              {classId ? "Select student..." : "Pick a class first"}
            </option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.rollNumber ? `${s.rollNumber} - ${s.name}` : s.name}
              </option>
            ))}
          </select>
          {errors.studentId ? (
            <p role="alert" className="text-destructive text-sm">
              {errors.studentId}
            </p>
          ) : null}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="flag-title">What happened</Label>
        <Input
          id="flag-title"
          name="title"
          placeholder="e.g. Disrupting class / Fighting in the playground"
          required
          aria-invalid={!!errors.title}
        />
        {errors.title ? (
          <p role="alert" className="text-destructive text-sm">
            {errors.title}
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="flag-detail">Details</Label>
        <Textarea
          id="flag-detail"
          name="detail"
          rows={3}
          placeholder="Describe the incident and any action taken."
          required
          aria-invalid={!!errors.detail}
        />
        {errors.detail ? (
          <p role="alert" className="text-destructive text-sm">
            {errors.detail}
          </p>
        ) : null}
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" variant="destructive" disabled={pending}>
          {pending ? "Raising..." : "Raise red flag"}
        </Button>
        {state.status === "success" ? (
          <p className="text-muted-foreground text-sm">{state.message}</p>
        ) : null}
        {state.status === "error" && !errors.studentId && !errors.title && !errors.detail ? (
          <p role="alert" className="text-destructive text-sm">
            {state.message}
          </p>
        ) : null}
      </div>
    </form>
  );
}
