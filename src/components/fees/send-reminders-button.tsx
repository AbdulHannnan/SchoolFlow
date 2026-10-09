"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { sendFeeRemindersAction } from "@/app/fees/actions";
import { initialFormState } from "@/app/fees/form-state";

/**
 * Sends fee reminders to parents of students with an outstanding balance,
 * scoped to the invoice list's current class/month filter (passed as hidden
 * fields). Shows how many went out.
 */
export function SendRemindersButton({ classId, period }: { classId: string; period: string }) {
  const [state, action, pending] = useActionState(sendFeeRemindersAction, initialFormState);

  return (
    <form action={action} className="flex flex-wrap items-center gap-3">
      <input type="hidden" name="classId" value={classId} />
      <input type="hidden" name="period" value={period} />
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Sending..." : "Send reminders"}
      </Button>
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
