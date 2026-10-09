"use client";

import { useActionState, useEffect, useRef } from "react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FEE_FREQUENCY_LABELS } from "@/lib/money";
import { createFeeStructureAction } from "@/app/fees/actions";
import { initialFormState } from "@/app/fees/form-state";

const selectClass = cn(
  "border-input dark:bg-input/30 h-9 w-full rounded-md border bg-transparent px-2 text-sm shadow-xs outline-none",
  "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
);

const FREQUENCIES = ["MONTHLY", "QUARTERLY", "ANNUAL", "ONE_TIME"] as const;

/**
 * Defines one fee: a category and amount, optionally pinned to a class
 * ("All classes" otherwise) and labelled. Resets on success so a head can add
 * several in a row.
 */
export function CreateFeeStructureForm({
  categories,
  classes,
}: {
  categories: { id: string; name: string }[];
  classes: { id: string; name: string }[];
}) {
  const [state, action, pending] = useActionState(createFeeStructureAction, initialFormState);
  const formRef = useRef<HTMLFormElement>(null);
  const errors = state.fieldErrors ?? {};

  useEffect(() => {
    if (state.status === "success") formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={action} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-2">
          <Label htmlFor="fee-category">Category</Label>
          <select
            id="fee-category"
            name="categoryId"
            defaultValue=""
            className={selectClass}
            aria-invalid={!!errors.categoryId}
          >
            <option value="" disabled>
              Select...
            </option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="fee-class">
            Class <span className="text-muted-foreground font-normal">(optional)</span>
          </Label>
          <select id="fee-class" name="classId" defaultValue="" className={selectClass}>
            <option value="">All classes</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="fee-amount">Amount (PKR)</Label>
          <Input
            id="fee-amount"
            name="amount"
            inputMode="decimal"
            placeholder="1500"
            required
            aria-invalid={!!errors.amount}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="fee-frequency">Frequency</Label>
          <select
            id="fee-frequency"
            name="frequency"
            defaultValue="MONTHLY"
            className={selectClass}
          >
            {FREQUENCIES.map((f) => (
              <option key={f} value={f}>
                {FEE_FREQUENCY_LABELS[f]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="fee-label">
          Label <span className="text-muted-foreground font-normal">(optional)</span>
        </Label>
        <Input id="fee-label" name="label" placeholder="e.g. Monthly tuition" className="sm:w-80" />
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Adding..." : "Add fee"}
        </Button>
        {state.status === "success" ? (
          <p className="text-muted-foreground text-sm">{state.message}</p>
        ) : null}
        {state.status === "error" ? (
          <p role="alert" className="text-destructive text-sm">
            {errors.amount ?? errors.categoryId ?? state.message}
          </p>
        ) : null}
      </div>
    </form>
  );
}
