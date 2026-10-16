"use client";

import { useActionState, useEffect, useRef } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createMeetingAction } from "@/app/meetings/actions";
import { initialFormState } from "@/app/meetings/form-state";

/**
 * Schedules a staff meeting and picks which teachers to invite. Checkboxes are
 * uncontrolled (All/None toggle them via the DOM), so a successful submit resets
 * them with the rest of the form. The invited teachers are notified server-side
 * after the meeting is created.
 */
export function CreateMeetingForm({
  teachers,
  defaultWhen,
}: {
  teachers: { id: string; name: string }[];
  defaultWhen: string;
}) {
  const [state, action, pending] = useActionState(createMeetingAction, initialFormState);
  const formRef = useRef<HTMLFormElement>(null);
  const errors = state.fieldErrors ?? {};

  useEffect(() => {
    if (state.status === "success") formRef.current?.reset();
  }, [state]);

  function setAll(checked: boolean) {
    formRef.current
      ?.querySelectorAll<HTMLInputElement>('input[name="teacherId"]')
      .forEach((box) => {
        box.checked = checked;
      });
  }

  return (
    <form ref={formRef} action={action} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="meeting-title">Title</Label>
          <Input
            id="meeting-title"
            name="title"
            placeholder="e.g. Monthly staff meeting"
            required
            aria-invalid={!!errors.title}
          />
          {errors.title ? (
            <p role="alert" className="text-destructive text-sm">
              {errors.title}
            </p>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="meeting-when">Date &amp; time</Label>
          <Input
            id="meeting-when"
            name="scheduledAt"
            type="datetime-local"
            defaultValue={defaultWhen}
            required
            aria-invalid={!!errors.scheduledAt}
          />
          {errors.scheduledAt ? (
            <p role="alert" className="text-destructive text-sm">
              {errors.scheduledAt}
            </p>
          ) : null}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="meeting-location">
          Location <span className="text-muted-foreground font-normal">(optional)</span>
        </Label>
        <Input id="meeting-location" name="location" placeholder="e.g. Staff room" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="meeting-agenda">
          Agenda <span className="text-muted-foreground font-normal">(optional)</span>
        </Label>
        <Textarea id="meeting-agenda" name="agenda" rows={3} placeholder="Points to discuss." />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Invite teachers</Label>
          {teachers.length > 0 ? (
            <div className="flex gap-2">
              <Button type="button" variant="secondary" size="sm" onClick={() => setAll(true)}>
                All
              </Button>
              <Button type="button" variant="secondary" size="sm" onClick={() => setAll(false)}>
                None
              </Button>
            </div>
          ) : null}
        </div>
        {teachers.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No teachers yet. Add teachers before scheduling a meeting.
          </p>
        ) : (
          <ul className="border-border grid gap-px rounded-md border sm:grid-cols-2">
            {teachers.map((t) => (
              <li key={t.id}>
                <label className="hover:bg-accent/40 flex cursor-pointer items-center gap-2 p-2 text-sm">
                  <input
                    type="checkbox"
                    name="teacherId"
                    value={t.id}
                    defaultChecked={false}
                    className="size-4"
                  />
                  {t.name}
                </label>
              </li>
            ))}
          </ul>
        )}
        {errors.teacherId ? (
          <p role="alert" className="text-destructive text-sm">
            {errors.teacherId}
          </p>
        ) : null}
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending || teachers.length === 0}>
          {pending ? "Scheduling..." : "Schedule & notify"}
        </Button>
        {state.status === "success" ? (
          <p className="text-muted-foreground text-sm">{state.message}</p>
        ) : null}
        {state.status === "error" && !errors.title && !errors.scheduledAt && !errors.teacherId ? (
          <p role="alert" className="text-destructive text-sm">
            {state.message}
          </p>
        ) : null}
      </div>
    </form>
  );
}
