"use client";

import { useActionState, useRef, useEffect } from "react";
import { Plus } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { createAssignmentAction } from "@/app/teachers/actions";
import { initialFormState } from "@/app/teachers/form-state";

type Option = { id: string; name: string };

const selectClass = cn(
  "border-input dark:bg-input/30 h-8 rounded-md border bg-transparent px-2 text-sm shadow-xs outline-none",
  "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
);

export function AssignTeacherForm({
  teacherId,
  subjects,
  classes,
}: {
  teacherId: string;
  subjects: Option[];
  classes: Option[];
}) {
  const [state, action, pending] = useActionState(createAssignmentAction, initialFormState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === "success") formRef.current?.reset();
  }, [state]);

  const disabled = subjects.length === 0 || classes.length === 0;

  return (
    <form ref={formRef} action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="teacherId" value={teacherId} />
      <select
        name="subjectId"
        required
        defaultValue=""
        className={selectClass}
        aria-label="Subject"
      >
        <option value="" disabled>
          Subject…
        </option>
        {subjects.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
      <select name="classId" required defaultValue="" className={selectClass} aria-label="Class">
        <option value="" disabled>
          Class…
        </option>
        {classes.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <Button type="submit" size="sm" variant="outline" disabled={pending || disabled}>
        <Plus className="size-4" />
        Assign
      </Button>
      {disabled ? (
        <span className="text-muted-foreground text-xs">Add a subject and a class first.</span>
      ) : null}
      {state.status === "error" && state.message ? (
        <span className="text-destructive text-xs">{state.message}</span>
      ) : null}
    </form>
  );
}
