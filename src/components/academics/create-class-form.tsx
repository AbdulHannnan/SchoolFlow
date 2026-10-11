"use client";

import { useActionState, useRef, useEffect } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClassAction } from "@/app/classes/actions";
import { initialFormState } from "@/app/classes/form-state";

type TeacherOption = { id: string; name: string };

const selectClass =
  "border-input dark:bg-input/30 h-9 w-full min-w-48 rounded-md border bg-transparent px-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]";

export function CreateClassForm({ teachers }: { teachers: TeacherOption[] }) {
  const [state, action, pending] = useActionState(createClassAction, initialFormState);
  const formRef = useRef<HTMLFormElement>(null);
  const errors = state.fieldErrors ?? {};

  // Clear the inputs after a successful add.
  useEffect(() => {
    if (state.status === "success") formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={action} className="flex flex-wrap items-end gap-3">
      <div className="space-y-2">
        <Label htmlFor="class-name">Class name</Label>
        <Input
          id="class-name"
          name="name"
          placeholder="Grade 1"
          required
          aria-invalid={!!errors.name}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="class-level">
          Level <span className="text-muted-foreground font-normal">(optional)</span>
        </Label>
        <Input id="class-level" name="level" type="number" min={0} max={20} className="w-24" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="class-teacher">
          Class teacher <span className="text-muted-foreground font-normal">(optional)</span>
        </Label>
        <select id="class-teacher" name="classTeacherId" className={selectClass} defaultValue="">
          <option value="">No class teacher</option>
          {teachers.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Adding..." : "Add class"}
      </Button>
      {state.status === "error" && (errors.name || errors.level) ? (
        <p role="alert" className="text-destructive w-full text-sm">
          {errors.name ?? errors.level}
        </p>
      ) : null}
    </form>
  );
}
