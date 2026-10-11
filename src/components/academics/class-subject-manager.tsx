"use client";

import { useActionState, useEffect, useRef } from "react";
import { Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { createAssignmentAction, deleteAssignmentAction } from "@/app/teachers/actions";
import { initialFormState } from "@/app/teachers/form-state";

type Option = { id: string; name: string };
type Assignment = {
  id: string;
  subject: { name: string };
  teacher: { name: string };
};

const selectClass =
  "border-input dark:bg-input/30 h-9 w-full rounded-md border bg-transparent px-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]";

/**
 * Inline manager for one class's subjects: lists the subject + teacher
 * assignments with a remove, and an add row (subject + teacher). Backed by the
 * shared TeacherAssignment actions, so it stays in sync with the Teachers page
 * and the class card's Subjects dropdown.
 */
export function ClassSubjectManager({
  classId,
  assignments,
  subjects,
  teachers,
}: {
  classId: string;
  assignments: Assignment[];
  subjects: Option[];
  teachers: Option[];
}) {
  const [state, action, pending] = useActionState(createAssignmentAction, initialFormState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === "success") formRef.current?.reset();
  }, [state]);

  return (
    <div className="space-y-4">
      {assignments.length === 0 ? (
        <p className="text-muted-foreground text-sm">No subjects defined for this class yet.</p>
      ) : (
        <ul className="divide-border divide-y">
          {assignments.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-2 py-2 text-sm">
              <span className="min-w-0">
                <span className="font-medium">{a.subject.name}</span>
                <span className="text-muted-foreground"> - {a.teacher.name}</span>
              </span>
              <form
                action={deleteAssignmentAction}
                onSubmit={(e) => {
                  if (!confirm(`Remove ${a.subject.name} (${a.teacher.name}) from this class?`))
                    e.preventDefault();
                }}
              >
                <input type="hidden" name="id" value={a.id} />
                <button
                  type="submit"
                  aria-label={`Remove ${a.subject.name}`}
                  className="text-muted-foreground hover:text-destructive grid size-7 place-items-center rounded"
                >
                  <X className="size-4" />
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}

      <form
        ref={formRef}
        action={action}
        className="grid gap-3 border-t pt-4 sm:grid-cols-3 sm:items-end"
      >
        <input type="hidden" name="classId" value={classId} />
        <div className="space-y-2">
          <Label htmlFor="cs-subject">Subject</Label>
          <select id="cs-subject" name="subjectId" defaultValue="" required className={selectClass}>
            <option value="" disabled>
              Select...
            </option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="cs-teacher">Teacher</Label>
          <select id="cs-teacher" name="teacherId" defaultValue="" required className={selectClass}>
            <option value="" disabled>
              Select...
            </option>
            {teachers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Button type="submit" disabled={pending} className="w-full">
            <Plus className="size-4" />
            {pending ? "Adding..." : "Add subject"}
          </Button>
        </div>
        {state.status === "error" && state.message ? (
          <p role="alert" className="text-destructive text-sm sm:col-span-3">
            {state.message}
          </p>
        ) : null}
      </form>
    </div>
  );
}
