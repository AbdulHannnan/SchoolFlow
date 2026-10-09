"use client";

import { useActionState, useEffect, useRef } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { submitBankTransferAction } from "@/app/fees/actions";
import { initialFormState } from "@/app/fees/form-state";

/**
 * Parent notifies the school of a bank transfer against their child's invoice.
 * The claim is held for verification and doesn't change the balance until a
 * head confirms it.
 */
export function SubmitBankTransferForm({
  invoiceId,
  defaultAmount,
}: {
  invoiceId: string;
  defaultAmount: string;
}) {
  const [state, action, pending] = useActionState(submitBankTransferAction, initialFormState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === "success") formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={action} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="invoiceId" value={invoiceId} />
      <div className="space-y-2">
        <Label htmlFor={`bt-amount-${invoiceId}`}>Amount (PKR)</Label>
        <Input
          id={`bt-amount-${invoiceId}`}
          name="amount"
          inputMode="decimal"
          defaultValue={defaultAmount}
          className="w-28"
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`bt-ref-${invoiceId}`}>Transfer reference</Label>
        <Input
          id={`bt-ref-${invoiceId}`}
          name="reference"
          placeholder="Bank txn / challan no."
          className="w-48"
          required
        />
      </div>
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        {pending ? "Submitting..." : "Notify bank transfer"}
      </Button>
      {state.status === "success" ? (
        <p className="text-muted-foreground w-full text-sm">{state.message}</p>
      ) : null}
      {state.status === "error" ? (
        <p role="alert" className="text-destructive w-full text-sm">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
