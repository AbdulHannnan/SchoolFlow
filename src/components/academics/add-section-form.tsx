"use client";

import { useActionState, useRef, useEffect } from "react";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createSectionAction } from "@/app/classes/actions";
import { initialFormState } from "@/app/classes/form-state";

type TeacherOption = { id: string; name: string };

const selectClass =
  "border-input dark:bg-input/30 h-8 w-40 rounded-md border bg-transparent px-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]";

export function AddSectionForm({
  classId,
  teachers,
}: {
  classId: string;
  teachers: TeacherOption[];
}) {
  const [state, action, pending] = useActionState(createSectionAction, initialFormState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === "success") formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="classId" value={classId} />
      <Input
        name="name"
        placeholder="Add section (e.g. A)"
        required
        className="h-8 w-40"
        aria-invalid={state.status === "error"}
      />
      <select
        name="sectionTeacherId"
        defaultValue=""
        className={selectClass}
        aria-label="Section teacher"
      >
        <option value="">No section teacher</option>
        {teachers.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        <Plus className="size-4" />
        Add
      </Button>
    </form>
  );
}
