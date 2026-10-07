"use client";

import { Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Submits a delete Server Action for one record, with a confirm() guard.
 * The action is passed in as a prop (a serializable server-action reference).
 */
export function DeleteButton({
  action,
  id,
  label,
}: {
  action: (formData: FormData) => void;
  id: string;
  label: string;
}) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm(`Delete ${label}? This cannot be undone.`)) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <Button
        type="submit"
        variant="ghost"
        size="icon"
        className="text-muted-foreground hover:text-destructive size-6"
        aria-label={`Delete ${label}`}
      >
        <Trash2 className="size-3.5" />
      </Button>
    </form>
  );
}
