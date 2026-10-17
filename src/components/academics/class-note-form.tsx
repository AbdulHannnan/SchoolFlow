"use client";

import { useActionState, useEffect, useRef } from "react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { addClassNoteAction } from "@/app/progress/actions";
import { initialFormState } from "@/app/progress/form-state";
import { CLASS_NOTE_TYPE_OPTIONS } from "@/lib/class-notes";

const selectClass = cn(
  "border-input dark:bg-input/30 h-9 w-full rounded-md border bg-transparent px-2 text-sm shadow-xs outline-none",
  "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
);

/**
 * Logs a qualitative class note (HEAD) - a head visit, a general observation, an
 * assembly activity, or a parent comment the office received. On success the
 * fields reset so several can be logged in a row.
 */
export function ClassNoteForm({
  classes,
  today,
}: {
  classes: { id: string; name: string }[];
  today: string;
}) {
  const [state, action, pending] = useActionState(addClassNoteAction, initialFormState);
  const formRef = useRef<HTMLFormElement>(null);
  const errors = state.fieldErrors ?? {};

  useEffect(() => {
    if (state.status === "success") formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={action} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="note-class">Class</Label>
          <select id="note-class" name="classId" defaultValue="" className={selectClass} required>
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
          <Label htmlFor="note-type">Type</Label>
          <select
            id="note-type"
            name="type"
            defaultValue="GENERAL"
            className={selectClass}
            required
          >
            {CLASS_NOTE_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="note-date">Date</Label>
          <Input id="note-date" name="date" type="date" defaultValue={today} required />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="note-title">Title</Label>
        <Input
          id="note-title"
          name="title"
          placeholder="e.g. Morning assembly - class presentation"
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
        <Label htmlFor="note-body">Detail</Label>
        <Textarea
          id="note-body"
          name="body"
          rows={3}
          placeholder="What happened, what to follow up on."
          required
          aria-invalid={!!errors.body}
        />
        {errors.body ? (
          <p role="alert" className="text-destructive text-sm">
            {errors.body}
          </p>
        ) : null}
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving..." : "Log note"}
        </Button>
        {state.status === "success" ? (
          <p className="text-muted-foreground text-sm">{state.message}</p>
        ) : null}
        {state.status === "error" && !errors.title && !errors.body ? (
          <p role="alert" className="text-destructive text-sm">
            {state.message}
          </p>
        ) : null}
      </div>
    </form>
  );
}
