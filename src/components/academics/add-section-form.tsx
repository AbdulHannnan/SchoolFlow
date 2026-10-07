"use client";

import { useActionState, useRef, useEffect } from "react";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createSectionAction } from "@/app/classes/actions";
import { initialFormState } from "@/app/classes/form-state";

export function AddSectionForm({ classId }: { classId: string }) {
  const [state, action, pending] = useActionState(createSectionAction, initialFormState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === "success") formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={action} className="flex items-center gap-2">
      <input type="hidden" name="classId" value={classId} />
      <Input
        name="name"
        placeholder="Add section (e.g. A)"
        required
        className="h-8 w-40"
        aria-invalid={state.status === "error"}
      />
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        <Plus className="size-4" />
        Add
      </Button>
    </form>
  );
}
