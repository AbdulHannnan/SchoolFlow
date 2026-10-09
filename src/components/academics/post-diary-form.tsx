"use client";

import { useActionState, useEffect, useRef } from "react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createDiaryEntryAction } from "@/app/homework/actions";
import { initialFormState } from "@/app/homework/form-state";

const selectClass = cn(
  "border-input dark:bg-input/30 h-9 w-full rounded-md border bg-transparent px-2 text-sm shadow-xs outline-none",
  "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
);

/**
 * Posts one homework/diary entry to the class + section fixed by the picker
 * (passed as hidden fields). Subject and due date are optional; on success the
 * fields reset so a teacher can post several in a row. The audience and any
 * notification are decided server-side from the class/section.
 */
export function PostDiaryForm({
  classId,
  sectionId,
  subjects,
  today,
}: {
  classId: string;
  sectionId: string;
  subjects: { id: string; name: string }[];
  today: string;
}) {
  const [state, action, pending] = useActionState(createDiaryEntryAction, initialFormState);
  const formRef = useRef<HTMLFormElement>(null);
  const errors = state.fieldErrors ?? {};

  useEffect(() => {
    if (state.status === "success") formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={action} className="space-y-4">
      <input type="hidden" name="classId" value={classId} />
      <input type="hidden" name="sectionId" value={sectionId} />

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="diary-type">Type</Label>
          <select id="diary-type" name="type" defaultValue="HOMEWORK" className={selectClass}>
            <option value="HOMEWORK">Homework</option>
            <option value="NOTE">Note</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="diary-subject">
            Subject <span className="text-muted-foreground font-normal">(optional)</span>
          </Label>
          <select id="diary-subject" name="subjectId" defaultValue="" className={selectClass}>
            <option value="">None</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="diary-date">Date</Label>
          <Input id="diary-date" name="date" type="date" defaultValue={today} required />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="diary-title">Title</Label>
        <Input
          id="diary-title"
          name="title"
          placeholder="e.g. Maths - Exercise 4.2"
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
        <Label htmlFor="diary-content">Details</Label>
        <Textarea
          id="diary-content"
          name="content"
          rows={4}
          placeholder="Questions 1-10, and read page 32."
          required
          aria-invalid={!!errors.content}
        />
        {errors.content ? (
          <p role="alert" className="text-destructive text-sm">
            {errors.content}
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="diary-due">
          Due date <span className="text-muted-foreground font-normal">(optional)</span>
        </Label>
        <Input id="diary-due" name="dueDate" type="date" className="w-44" />
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Posting..." : "Post"}
        </Button>
        {state.status === "success" ? (
          <p className="text-muted-foreground text-sm">{state.message}</p>
        ) : null}
        {state.status === "error" && !errors.title && !errors.content ? (
          <p role="alert" className="text-destructive text-sm">
            {state.message}
          </p>
        ) : null}
      </div>
    </form>
  );
}
