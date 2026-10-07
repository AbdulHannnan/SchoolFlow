"use client";

import { useActionState, useRef, useEffect, useState } from "react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createStudentAction } from "@/app/students/actions";
import { initialFormState } from "@/app/students/form-state";

export type ClassOption = {
  id: string;
  name: string;
  sections: { id: string; name: string }[];
};

const selectClass = cn(
  "border-input dark:bg-input/30 h-9 w-full rounded-md border bg-transparent px-2 text-sm shadow-xs outline-none",
  "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
);

export function CreateStudentForm({ classes }: { classes: ClassOption[] }) {
  const [state, action, pending] = useActionState(createStudentAction, initialFormState);
  const formRef = useRef<HTMLFormElement>(null);
  const [classId, setClassId] = useState("");
  const errors = state.fieldErrors ?? {};

  useEffect(() => {
    // reset() fires the form's onReset below, which clears the controlled class
    // select - keeping all state updates out of this effect.
    if (state.status === "success") formRef.current?.reset();
  }, [state]);

  const sections = classes.find((c) => c.id === classId)?.sections ?? [];

  return (
    <form
      ref={formRef}
      action={action}
      onReset={() => setClassId("")}
      className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
    >
      <div className="space-y-2">
        <Label htmlFor="student-name">Full name</Label>
        <Input id="student-name" name="name" required aria-invalid={!!errors.name} />
        {errors.name ? <p className="text-destructive text-xs">{errors.name}</p> : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="student-roll">
          Roll number <span className="text-muted-foreground font-normal">(optional)</span>
        </Label>
        <Input id="student-roll" name="rollNumber" aria-invalid={!!errors.rollNumber} />
        {errors.rollNumber ? <p className="text-destructive text-xs">{errors.rollNumber}</p> : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="student-class">Class</Label>
        <select
          id="student-class"
          name="classId"
          required
          value={classId}
          onChange={(e) => setClassId(e.target.value)}
          className={selectClass}
          aria-invalid={!!errors.classId}
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
        {errors.classId ? <p className="text-destructive text-xs">{errors.classId}</p> : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="student-section">
          Section <span className="text-muted-foreground font-normal">(optional)</span>
        </Label>
        <select
          id="student-section"
          name="sectionId"
          defaultValue=""
          disabled={sections.length === 0}
          className={selectClass}
        >
          <option value="">{sections.length === 0 ? "No sections" : "Unassigned"}</option>
          {sections.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="student-gender">
          Gender <span className="text-muted-foreground font-normal">(optional)</span>
        </Label>
        <select id="student-gender" name="gender" defaultValue="" className={selectClass}>
          <option value="">-</option>
          <option value="MALE">Male</option>
          <option value="FEMALE">Female</option>
          <option value="OTHER">Other</option>
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="student-dob">
          Date of birth <span className="text-muted-foreground font-normal">(optional)</span>
        </Label>
        <Input id="student-dob" name="dateOfBirth" type="date" />
      </div>

      <div className="lg:col-span-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Adding..." : "Add student"}
        </Button>
        {state.status === "error" && state.message ? (
          <span className="text-destructive ml-3 text-sm">{state.message}</span>
        ) : null}
      </div>
    </form>
  );
}
