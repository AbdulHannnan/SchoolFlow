"use client";

import { useActionState, useState } from "react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createExamAction } from "@/app/exams/actions";
import { initialFormState } from "@/app/exams/form-state";
import { EXAM_TYPE_OPTIONS } from "@/lib/grades";

const selectClass = cn(
  "border-input dark:bg-input/30 h-9 w-full rounded-md border bg-transparent px-2 text-sm shadow-xs outline-none",
  "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
);

/**
 * Defines an exam for one class (fixed via a hidden field) and the subject
 * papers it covers. Each subject has an include checkbox plus maximum and
 * optional passing marks; only checked subjects are submitted. On success the
 * action redirects to the new exam, so there is no success branch here.
 */
export function CreateExamForm({
  classId,
  className,
  subjects,
  today,
}: {
  classId: string;
  className: string;
  subjects: { id: string; name: string }[];
  today: string;
}) {
  const [state, action, pending] = useActionState(createExamAction, initialFormState);
  const errors = state.fieldErrors ?? {};
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="classId" value={classId} />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="exam-name">Exam name</Label>
          <Input
            id="exam-name"
            name="name"
            placeholder={`e.g. First Term - ${className}`}
            required
            aria-invalid={!!errors.name}
          />
          {errors.name ? (
            <p role="alert" className="text-destructive text-sm">
              {errors.name}
            </p>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="exam-type">Type</Label>
          <select id="exam-type" name="type" defaultValue="TERM" className={selectClass}>
            {EXAM_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="exam-term">
            Term <span className="text-muted-foreground font-normal">(optional)</span>
          </Label>
          <Input id="exam-term" name="term" placeholder="e.g. Term 1 or 2026-2027" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="exam-date">
            Start date <span className="text-muted-foreground font-normal">(optional)</span>
          </Label>
          <Input
            id="exam-date"
            name="startDate"
            type="date"
            defaultValue={today}
            className="w-44"
          />
        </div>
      </div>

      <fieldset className="space-y-3">
        <legend className="text-sm font-medium">Subjects &amp; marks</legend>
        {subjects.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No subjects exist yet. Add subjects first, then create an exam.
          </p>
        ) : (
          <ul className="divide-border divide-y rounded-md border">
            {subjects.map((s) => {
              const on = checked[s.id] ?? false;
              return (
                <li
                  key={s.id}
                  className="grid items-center gap-3 px-3 py-2.5 sm:grid-cols-[1fr_auto_auto]"
                >
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      name="subject"
                      value={s.id}
                      checked={on}
                      onChange={(e) =>
                        setChecked((prev) => ({ ...prev, [s.id]: e.target.checked }))
                      }
                      className="size-4"
                    />
                    {s.name}
                  </label>
                  <div className="flex items-center gap-2">
                    <Label htmlFor={`max_${s.id}`} className="text-muted-foreground text-xs">
                      Max
                    </Label>
                    <Input
                      id={`max_${s.id}`}
                      name={`max_${s.id}`}
                      inputMode="decimal"
                      placeholder="100"
                      disabled={!on}
                      required={on}
                      className="h-8 w-24"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Label htmlFor={`pass_${s.id}`} className="text-muted-foreground text-xs">
                      Pass
                    </Label>
                    <Input
                      id={`pass_${s.id}`}
                      name={`pass_${s.id}`}
                      inputMode="decimal"
                      placeholder="33"
                      disabled={!on}
                      className="h-8 w-24"
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </fieldset>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending || subjects.length === 0}>
          {pending ? "Creating..." : "Create exam"}
        </Button>
        {state.status === "error" ? (
          <p role="alert" className="text-destructive text-sm">
            {state.message}
          </p>
        ) : null}
      </div>
    </form>
  );
}
