"use client";

import { useActionState, useRef, useEffect } from "react";
import { Plus } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { linkStudentAction } from "@/app/parents/actions";
import { initialFormState } from "@/app/parents/form-state";

type StudentOption = { id: string; label: string };

const selectClass = cn(
  "border-input dark:bg-input/30 h-8 rounded-md border bg-transparent px-2 text-sm shadow-xs outline-none",
  "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
);

export function LinkStudentForm({
  parentId,
  students,
}: {
  parentId: string;
  students: StudentOption[];
}) {
  const [state, action, pending] = useActionState(linkStudentAction, initialFormState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === "success") formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="parentId" value={parentId} />
      <select
        name="studentId"
        required
        defaultValue=""
        className={selectClass}
        aria-label="Student"
      >
        <option value="" disabled>
          Student...
        </option>
        {students.map((s) => (
          <option key={s.id} value={s.id}>
            {s.label}
          </option>
        ))}
      </select>
      <select name="relation" defaultValue="" className={selectClass} aria-label="Relation">
        <option value="">Relation...</option>
        <option value="FATHER">Father</option>
        <option value="MOTHER">Mother</option>
        <option value="GUARDIAN">Guardian</option>
        <option value="OTHER">Other</option>
      </select>
      <Button type="submit" size="sm" variant="outline" disabled={pending || students.length === 0}>
        <Plus className="size-4" />
        Link
      </Button>
      {state.status === "error" && state.message ? (
        <span className="text-destructive text-xs">{state.message}</span>
      ) : null}
    </form>
  );
}
