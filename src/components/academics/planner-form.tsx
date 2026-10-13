"use client";

import { useActionState, useEffect, useRef } from "react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createPlannerEntryAction } from "@/app/planner/actions";
import { initialFormState } from "@/app/planner/form-state";

const selectClass = cn(
  "border-input dark:bg-input/30 h-9 w-full rounded-md border bg-transparent px-2 text-sm shadow-xs outline-none",
  "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
);

/**
 * Adds one lesson plan to the register for the chosen class + subject + date.
 * On success the fields reset so a teacher can plan several in a row. Re-saving
 * the same class/subject/date edits that plan (idempotent server-side).
 */
export function PlannerForm({
  classes,
  subjects,
  today,
}: {
  classes: { id: string; name: string }[];
  subjects: { id: string; name: string }[];
  today: string;
}) {
  const [state, action, pending] = useActionState(createPlannerEntryAction, initialFormState);
  const formRef = useRef<HTMLFormElement>(null);
  const errors = state.fieldErrors ?? {};

  useEffect(() => {
    if (state.status === "success") formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={action} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="planner-class">Class</Label>
          <select
            id="planner-class"
            name="classId"
            defaultValue=""
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
          <Label htmlFor="planner-subject">Subject</Label>
          <select
            id="planner-subject"
            name="subjectId"
            defaultValue=""
            className={selectClass}
            required
          >
            <option value="" disabled>
              Select subject...
            </option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="planner-date">Date</Label>
          <Input id="planner-date" name="date" type="date" defaultValue={today} required />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="planner-topic">Topic</Label>
        <Input
          id="planner-topic"
          name="topic"
          placeholder="e.g. Fractions - adding unlike denominators"
          required
          aria-invalid={!!errors.topic}
        />
        {errors.topic ? (
          <p role="alert" className="text-destructive text-sm">
            {errors.topic}
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="planner-details">Plan</Label>
        <Textarea
          id="planner-details"
          name="details"
          rows={4}
          placeholder="Objectives, activities, and resources for the lesson."
          required
          aria-invalid={!!errors.details}
        />
        {errors.details ? (
          <p role="alert" className="text-destructive text-sm">
            {errors.details}
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="planner-homework">
          Homework planned <span className="text-muted-foreground font-normal">(optional)</span>
        </Label>
        <Input
          id="planner-homework"
          name="homework"
          placeholder="e.g. Exercise 4.2, questions 1-10"
        />
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving..." : "Save plan"}
        </Button>
        {state.status === "success" ? (
          <p className="text-muted-foreground text-sm">{state.message}</p>
        ) : null}
        {state.status === "error" && !errors.topic && !errors.details ? (
          <p role="alert" className="text-destructive text-sm">
            {state.message}
          </p>
        ) : null}
      </div>
    </form>
  );
}
