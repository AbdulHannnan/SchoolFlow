"use client";

import { useActionState, useEffect, useRef } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createFeeCategoryAction } from "@/app/fees/actions";
import { initialFormState } from "@/app/fees/form-state";

export function CreateFeeCategoryForm() {
  const [state, action, pending] = useActionState(createFeeCategoryAction, initialFormState);
  const formRef = useRef<HTMLFormElement>(null);
  const errors = state.fieldErrors ?? {};

  useEffect(() => {
    if (state.status === "success") formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={action} className="flex flex-wrap items-end gap-3">
      <div className="space-y-2">
        <Label htmlFor="fee-category-name">Category name</Label>
        <Input
          id="fee-category-name"
          name="name"
          placeholder="Tuition"
          required
          aria-invalid={!!errors.name}
        />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Adding..." : "Add category"}
      </Button>
      {state.status === "error" && errors.name ? (
        <p role="alert" className="text-destructive w-full text-sm">
          {errors.name}
        </p>
      ) : null}
    </form>
  );
}
