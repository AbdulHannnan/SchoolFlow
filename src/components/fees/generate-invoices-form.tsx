"use client";

import { useActionState, useState } from "react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { generateInvoicesAction } from "@/app/fees/actions";
import { initialFormState } from "@/app/fees/form-state";

export type InvoiceClass = {
  id: string;
  name: string;
  sections: { id: string; name: string }[];
};

const selectClass = cn(
  "border-input dark:bg-input/30 h-9 w-full rounded-md border bg-transparent px-2 text-sm shadow-xs outline-none",
  "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
);

/**
 * Generates a month's invoices for a class (optionally one section). The server
 * builds each invoice from the monthly fees that apply and skips students who
 * already have an invoice for the month, so this is safe to re-run.
 */
export function GenerateInvoicesForm({
  classes,
  defaultMonth,
}: {
  classes: InvoiceClass[];
  defaultMonth: string;
}) {
  const [state, action, pending] = useActionState(generateInvoicesAction, initialFormState);
  const [classId, setClassId] = useState("");
  const sections = classes.find((c) => c.id === classId)?.sections ?? [];

  return (
    <form action={action} className="space-y-4">
      <div className="grid items-end gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-2">
          <Label htmlFor="gen-class">Class</Label>
          <select
            id="gen-class"
            name="classId"
            value={classId}
            onChange={(e) => setClassId(e.target.value)}
            className={selectClass}
          >
            <option value="" disabled>
              Select...
            </option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="gen-section">
            Section <span className="text-muted-foreground font-normal">(optional)</span>
          </Label>
          <select
            id="gen-section"
            name="sectionId"
            disabled={sections.length === 0}
            className={selectClass}
          >
            <option value="">{sections.length === 0 ? "Whole class" : "Whole class"}</option>
            {sections.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="gen-month">Billing month</Label>
          <Input id="gen-month" name="period" type="month" defaultValue={defaultMonth} required />
        </div>

        <div className="space-y-2">
          <Label htmlFor="gen-due">
            Due date <span className="text-muted-foreground font-normal">(optional)</span>
          </Label>
          <Input id="gen-due" name="dueDate" type="date" />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending || !classId}>
          {pending ? "Generating..." : "Generate invoices"}
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
