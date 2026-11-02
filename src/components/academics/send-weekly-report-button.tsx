"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { sendStudentWeeklyReportAction } from "@/app/progress/actions";
import { initialFormState } from "@/app/progress/form-state";

/**
 * Sends this student's weekly report (attendance, performance, red flags) to
 * their linked parent(s) over WhatsApp + in-app. HEAD-only; the action enforces
 * it. Stays inert until the school's WhatsApp number is set, in which case the
 * action returns a clear setup message.
 */
export function SendWeeklyReportButton({
  studentId,
  label = "Send weekly report",
}: {
  studentId: string;
  label?: string;
}) {
  const [state, action, pending] = useActionState(sendStudentWeeklyReportAction, initialFormState);

  return (
    <form action={action} className="flex flex-wrap items-center gap-3">
      <input type="hidden" name="studentId" value={studentId} />
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Sending..." : label}
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
