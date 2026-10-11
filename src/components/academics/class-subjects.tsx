"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { BookOpen, ChevronDown, Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { createAssignmentAction, deleteAssignmentAction } from "@/app/teachers/actions";
import { initialFormState } from "@/app/teachers/form-state";

type Option = { id: string; name: string };
type Assignment = {
  id: string;
  subjectId: string;
  teacherId: string;
  subject: { name: string };
  teacher: { name: string };
};

const selectClass =
  "border-input dark:bg-input/30 h-8 min-w-0 flex-1 rounded-md border bg-transparent px-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]";

/**
 * A per-class dropdown that lists the subjects taught in the class with the
 * teacher assigned to each, and lets a HEAD edit them: remove an assignment, or
 * add a subject + teacher. Backed by the shared TeacherAssignment actions, so
 * changes here and on the Teachers page stay in sync.
 */
export function ClassSubjects({
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
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(createAssignmentAction, initialFormState);
  const formRef = useRef<HTMLFormElement>(null);

  // Clear the add row's selects after a successful add (the server refresh
  // updates the list below).
  useEffect(() => {
    if (state.status === "success") formRef.current?.reset();
  }, [state]);

  return (
    <div className="relative">
      <Button
        variant="outline"
        size="sm"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <BookOpen className="size-4" />
        Subjects
        <span className="text-muted-foreground">({assignments.length})</span>
        <ChevronDown className="size-4" />
      </Button>

      {open ? (
        <>
          <button
            type="button"
            aria-hidden
            tabIndex={-1}
            className="fixed inset-0 z-10 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div className="bg-popover text-popover-foreground absolute right-0 z-20 mt-1 w-80 max-w-[calc(100vw-2rem)] rounded-md border p-3 shadow-md">
            <p className="mb-2 text-sm font-medium">Subjects & teachers</p>

            {assignments.length === 0 ? (
              <p className="text-muted-foreground text-sm">No subjects assigned yet.</p>
            ) : (
              <ul className="space-y-1">
                {assignments.map((a) => (
                  <li
                    key={a.id}
                    className="hover:bg-accent/50 flex items-center justify-between gap-2 rounded px-2 py-1 text-sm"
                  >
                    <span className="min-w-0 truncate">
                      <span className="font-medium">{a.subject.name}</span>
                      <span className="text-muted-foreground"> - {a.teacher.name}</span>
                    </span>
                    <form
                      action={deleteAssignmentAction}
                      onSubmit={(e) => {
                        if (
                          !confirm(`Remove ${a.subject.name} (${a.teacher.name}) from this class?`)
                        )
                          e.preventDefault();
                      }}
                    >
                      <input type="hidden" name="id" value={a.id} />
                      <button
                        type="submit"
                        aria-label={`Remove ${a.subject.name}`}
                        className="text-muted-foreground hover:text-destructive grid size-6 place-items-center rounded"
                      >
                        <X className="size-4" />
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            )}

            <form ref={formRef} action={action} className="mt-3 space-y-2 border-t pt-3">
              <input type="hidden" name="classId" value={classId} />
              <div className="flex items-center gap-2">
                <select name="subjectId" defaultValue="" required className={selectClass}>
                  <option value="" disabled>
                    Subject
                  </option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                <select name="teacherId" defaultValue="" required className={selectClass}>
                  <option value="" disabled>
                    Teacher
                  </option>
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
              {state.status === "error" && state.message ? (
                <p role="alert" className="text-destructive text-xs">
                  {state.message}
                </p>
              ) : null}
              <Button type="submit" size="sm" variant="secondary" disabled={pending}>
                <Plus className="size-4" />
                {pending ? "Adding..." : "Add subject"}
              </Button>
            </form>
          </div>
        </>
      ) : null}
    </div>
  );
}
