"use client";

import { useActionState } from "react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { sendClassWeeklyReportsAction } from "@/app/progress/actions";
import { initialFormState } from "@/app/progress/form-state";

const selectClass = cn(
  "border-input dark:bg-input/30 h-9 w-full rounded-md border bg-transparent px-2 text-sm shadow-xs outline-none",
  "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
);

/**
 * Sends a weekly report for every active student in the chosen class to each
 * student's linked parent(s), over WhatsApp + in-app. HEAD-only (the action
 * enforces it). Reports the counts, or a setup message when the school's
 * WhatsApp number has not been set yet.
 */
export function SendClassWeeklyReportsForm({
  classes,
}: {
  classes: { id: string; name: string }[];
}) {
  const [state, action, pending] = useActionState(sendClassWeeklyReportsAction, initialFormState);

  return (
    <form action={action} className="space-y-3">
      <div className="grid items-end gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="weekly-report-class">Class</Label>
          <select
            id="weekly-report-class"
            name="classId"
            defaultValue=""
            className={selectClass}
            required
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
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? "Sending..." : "Send to whole class"}
        </Button>
      </div>
      {state.status === "success" ? (
        <p className="text-muted-foreground text-sm">{state.message}</p>
      ) : null}
      {state.status === "error" ? (
        <p role="alert" className="text-destructive text-sm">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
