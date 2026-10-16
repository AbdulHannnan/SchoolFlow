"use client";

import { useActionState, useEffect, useRef } from "react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { submitExamPaperAction, updateExamPaperAction } from "@/app/exams/papers/actions";
import { initialFormState } from "@/app/exams/form-state";

const selectClass = cn(
  "border-input dark:bg-input/30 h-9 w-full rounded-md border bg-transparent px-2 text-sm shadow-xs outline-none",
  "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
);

export type PaperDefaults = {
  id: string;
  classId: string;
  subjectId: string;
  title: string;
  examDate: string;
  fileUrl: string;
  notes: string | null;
};

/**
 * A teacher submits a question paper for review: class + subject + exam date,
 * plus a link to the paper (Drive/OneDrive) and optional notes. With `paper`
 * set it edits and re-submits that paper instead (status returns to review); a
 * fresh submission resets its fields so several can be added in a row.
 */
export function SubmitPaperForm({
  classes,
  subjects,
  today,
  paper,
}: {
  classes: { id: string; name: string }[];
  subjects: { id: string; name: string }[];
  today: string;
  paper?: PaperDefaults;
}) {
  const isEdit = !!paper;
  const [state, action, pending] = useActionState(
    isEdit ? updateExamPaperAction : submitExamPaperAction,
    initialFormState,
  );
  const formRef = useRef<HTMLFormElement>(null);
  const errors = state.fieldErrors ?? {};

  useEffect(() => {
    // Only a brand-new submission clears the form; an edit keeps its values.
    if (state.status === "success" && !isEdit) formRef.current?.reset();
  }, [state, isEdit]);

  return (
    <form ref={formRef} action={action} className="space-y-4">
      {paper ? <input type="hidden" name="id" value={paper.id} /> : null}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor={`paper-class-${paper?.id ?? "new"}`}>Class</Label>
          <select
            id={`paper-class-${paper?.id ?? "new"}`}
            name="classId"
            defaultValue={paper?.classId ?? ""}
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
          <Label htmlFor={`paper-subject-${paper?.id ?? "new"}`}>Subject</Label>
          <select
            id={`paper-subject-${paper?.id ?? "new"}`}
            name="subjectId"
            defaultValue={paper?.subjectId ?? ""}
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
          <Label htmlFor={`paper-date-${paper?.id ?? "new"}`}>Exam date</Label>
          <Input
            id={`paper-date-${paper?.id ?? "new"}`}
            name="examDate"
            type="date"
            defaultValue={paper?.examDate ?? today}
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`paper-title-${paper?.id ?? "new"}`}>Title</Label>
        <Input
          id={`paper-title-${paper?.id ?? "new"}`}
          name="title"
          defaultValue={paper?.title ?? ""}
          placeholder="e.g. First Term - Mathematics"
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
        <Label htmlFor={`paper-url-${paper?.id ?? "new"}`}>Paper link</Label>
        <Input
          id={`paper-url-${paper?.id ?? "new"}`}
          name="fileUrl"
          type="url"
          defaultValue={paper?.fileUrl ?? ""}
          placeholder="https://drive.google.com/..."
          required
          aria-invalid={!!errors.fileUrl}
        />
        {errors.fileUrl ? (
          <p role="alert" className="text-destructive text-sm">
            {errors.fileUrl}
          </p>
        ) : (
          <p className="text-muted-foreground text-xs">
            Share a link (Google Drive, OneDrive, etc.) the head can open to review.
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor={`paper-notes-${paper?.id ?? "new"}`}>
          Notes <span className="text-muted-foreground font-normal">(optional)</span>
        </Label>
        <Textarea
          id={`paper-notes-${paper?.id ?? "new"}`}
          name="notes"
          rows={2}
          defaultValue={paper?.notes ?? ""}
          placeholder="Anything the head should know."
        />
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending
            ? isEdit
              ? "Saving..."
              : "Submitting..."
            : isEdit
              ? "Save & re-submit"
              : "Submit for review"}
        </Button>
        {state.status === "success" ? (
          <p className="text-muted-foreground text-sm">{state.message}</p>
        ) : null}
        {state.status === "error" && !errors.title && !errors.fileUrl ? (
          <p role="alert" className="text-destructive text-sm">
            {state.message}
          </p>
        ) : null}
      </div>
    </form>
  );
}
