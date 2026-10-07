"use client";

import { useActionState, useRef, useEffect } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createParentAction } from "@/app/parents/actions";
import { initialFormState } from "@/app/parents/form-state";

export function CreateParentForm() {
  const [state, action, pending] = useActionState(createParentAction, initialFormState);
  const formRef = useRef<HTMLFormElement>(null);
  const errors = state.fieldErrors ?? {};

  useEffect(() => {
    if (state.status === "success") formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={action} className="grid gap-4 sm:grid-cols-3">
      <div className="space-y-2">
        <Label htmlFor="parent-name">Full name</Label>
        <Input id="parent-name" name="name" required aria-invalid={!!errors.name} />
        {errors.name ? <p className="text-destructive text-xs">{errors.name}</p> : null}
      </div>
      <div className="space-y-2">
        <Label htmlFor="parent-email">Email</Label>
        <Input id="parent-email" name="email" type="email" required aria-invalid={!!errors.email} />
        {errors.email ? <p className="text-destructive text-xs">{errors.email}</p> : null}
      </div>
      <div className="space-y-2">
        <Label htmlFor="parent-password">Temporary password</Label>
        <Input
          id="parent-password"
          name="password"
          type="password"
          required
          aria-invalid={!!errors.password}
        />
        {errors.password ? <p className="text-destructive text-xs">{errors.password}</p> : null}
      </div>
      <div className="sm:col-span-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Adding..." : "Add parent"}
        </Button>
      </div>
    </form>
  );
}
