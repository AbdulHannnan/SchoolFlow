"use client";

import { useActionState, useRef, useEffect } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createTeacherAction } from "@/app/teachers/actions";
import { initialFormState } from "@/app/teachers/form-state";

type SubjectOption = { id: string; name: string };

const selectClass =
  "border-input dark:bg-input/30 h-9 w-full rounded-md border bg-transparent px-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]";

export function CreateTeacherForm({ subjects }: { subjects: SubjectOption[] }) {
  const [state, action, pending] = useActionState(createTeacherAction, initialFormState);
  const formRef = useRef<HTMLFormElement>(null);
  const errors = state.fieldErrors ?? {};

  useEffect(() => {
    if (state.status === "success") formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={action} className="grid gap-4 sm:grid-cols-3">
      <div className="space-y-2">
        <Label htmlFor="teacher-name">Full name</Label>
        <Input id="teacher-name" name="name" required aria-invalid={!!errors.name} />
        {errors.name ? <p className="text-destructive text-xs">{errors.name}</p> : null}
      </div>
      <div className="space-y-2">
        <Label htmlFor="teacher-email">Email</Label>
        <Input
          id="teacher-email"
          name="email"
          type="email"
          required
          aria-invalid={!!errors.email}
        />
        {errors.email ? <p className="text-destructive text-xs">{errors.email}</p> : null}
      </div>
      <div className="space-y-2">
        <Label htmlFor="teacher-password">Temporary password</Label>
        <Input
          id="teacher-password"
          name="password"
          type="password"
          required
          aria-invalid={!!errors.password}
        />
        {errors.password ? <p className="text-destructive text-xs">{errors.password}</p> : null}
      </div>
      <div className="space-y-2">
        <Label htmlFor="teacher-subject">
          Main subject <span className="text-muted-foreground font-normal">(optional)</span>
        </Label>
        <select id="teacher-subject" name="mainSubjectId" defaultValue="" className={selectClass}>
          <option value="">No main subject</option>
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>
      <div className="sm:col-span-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Adding..." : "Add teacher"}
        </Button>
      </div>
    </form>
  );
}
