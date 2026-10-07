"use client";

import { useActionState, useRef, useEffect } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createSubjectAction } from "@/app/subjects/actions";
import { initialFormState } from "@/app/subjects/form-state";

export function CreateSubjectForm() {
  const [state, action, pending] = useActionState(createSubjectAction, initialFormState);
  const formRef = useRef<HTMLFormElement>(null);
  const errors = state.fieldErrors ?? {};

  useEffect(() => {
    if (state.status === "success") formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={action} className="flex flex-wrap items-end gap-3">
      <div className="space-y-2">
        <Label htmlFor="subject-name">Subject name</Label>
        <Input
          id="subject-name"
          name="name"
          placeholder="Mathematics"
          required
          aria-invalid={!!errors.name}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="subject-code">
          Code <span className="text-muted-foreground font-normal">(optional)</span>
        </Label>
        <Input id="subject-code" name="code" placeholder="MATH" className="w-32" />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Adding..." : "Add subject"}
      </Button>
      {state.status === "error" && errors.name ? (
        <p role="alert" className="text-destructive w-full text-sm">
          {errors.name}
        </p>
      ) : null}
    </form>
  );
}
