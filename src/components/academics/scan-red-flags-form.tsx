"use client";

import { useActionState } from "react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { scanRedFlagsAction } from "@/app/red-flags/actions";
import { initialFormState } from "@/app/red-flags/form-state";

const selectClass = cn(
  "border-input dark:bg-input/30 h-9 w-full rounded-md border bg-transparent px-2 text-sm shadow-xs outline-none",
  "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
);

/**
 * Runs the red-flag scan for an optional class and month (defaults: all classes,
 * current month). Attendance is evaluated for the chosen month; grades are
 * evaluated across the scope's published exams.
 */
export function ScanRedFlagsForm({
  classes,
  defaultMonth,
}: {
  classes: { id: string; name: string }[];
  defaultMonth: string;
}) {
  const [state, action, pending] = useActionState(scanRedFlagsAction, initialFormState);

  return (
    <form action={action} className="grid items-end gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div className="space-y-2">
        <Label htmlFor="scan-class">
          Class <span className="text-muted-foreground font-normal">(optional)</span>
        </Label>
        <select id="scan-class" name="classId" defaultValue="" className={selectClass}>
          <option value="">All classes</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="scan-month">Attendance month</Label>
        <Input id="scan-month" name="month" type="month" defaultValue={defaultMonth} />
      </div>
      <div className="flex items-center gap-3 sm:col-span-2 lg:col-span-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Scanning..." : "Run scan"}
        </Button>
        {state.status === "success" ? (
          <p className="text-muted-foreground text-sm">{state.message}</p>
        ) : null}
        {state.status === "error" ? (
          <p role="alert" className="text-destructive text-sm">
            {state.message}
          </p>
        ) : null}
      </div>
    </form>
  );
}
