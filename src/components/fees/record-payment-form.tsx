"use client";

import { useActionState, useEffect, useRef } from "react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PAYMENT_METHOD_LABELS } from "@/lib/money";
import { recordPaymentAction } from "@/app/fees/actions";
import { initialFormState } from "@/app/fees/form-state";

const selectClass = cn(
  "border-input dark:bg-input/30 h-9 w-full rounded-md border bg-transparent px-2 text-sm shadow-xs outline-none",
  "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
);

const METHODS = ["CASH", "BANK_TRANSFER", "CARD", "OTHER"] as const;

/** HEAD records a manual payment against an invoice; applies immediately. */
export function RecordPaymentForm({
  invoiceId,
  defaultAmount,
}: {
  invoiceId: string;
  defaultAmount: string;
}) {
  const [state, action, pending] = useActionState(recordPaymentAction, initialFormState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === "success") formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={action} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="invoiceId" value={invoiceId} />
      <div className="space-y-2">
        <Label htmlFor={`pay-amount-${invoiceId}`}>Amount (PKR)</Label>
        <Input
          id={`pay-amount-${invoiceId}`}
          name="amount"
          inputMode="decimal"
          defaultValue={defaultAmount}
          className="w-28"
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`pay-method-${invoiceId}`}>Method</Label>
        <select
          id={`pay-method-${invoiceId}`}
          name="method"
          defaultValue="CASH"
          className={selectClass}
        >
          {METHODS.map((m) => (
            <option key={m} value={m}>
              {PAYMENT_METHOD_LABELS[m]}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor={`pay-ref-${invoiceId}`}>
          Reference <span className="text-muted-foreground font-normal">(optional)</span>
        </Label>
        <Input id={`pay-ref-${invoiceId}`} name="reference" className="w-40" />
      </div>
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Recording..." : "Record payment"}
      </Button>
      {state.status === "error" ? (
        <p role="alert" className="text-destructive w-full text-sm">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
