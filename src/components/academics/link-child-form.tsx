"use client";

import { useActionState, useEffect, useRef } from "react";
import { Link2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { linkStudentAction } from "@/app/parents/actions";
import { initialFormState } from "@/app/parents/form-state";

type ParentOption = { id: string; name: string };
type StudentOption = { id: string; label: string };

const selectClass =
  "border-input dark:bg-input/30 h-9 w-full rounded-md border bg-transparent px-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]";

/** Link an existing parent to a student (defines which grade the parent shows
 * under). Reuses the shared linkStudent action. */
export function LinkChildForm({
  parents,
  students,
}: {
  parents: ParentOption[];
  students: StudentOption[];
}) {
  const [state, action, pending] = useActionState(linkStudentAction, initialFormState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === "success") formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={action} className="grid gap-3 sm:grid-cols-4 sm:items-end">
      <div className="space-y-2">
        <Label htmlFor="link-parent">Parent</Label>
        <select id="link-parent" name="parentId" defaultValue="" required className={selectClass}>
          <option value="" disabled>
            Select...
          </option>
          {parents.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="link-student">Child</Label>
        <select id="link-student" name="studentId" defaultValue="" required className={selectClass}>
          <option value="" disabled>
            Select...
          </option>
          {students.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="link-relation">
          Relation <span className="text-muted-foreground font-normal">(optional)</span>
        </Label>
        <select id="link-relation" name="relation" defaultValue="" className={selectClass}>
          <option value="">-</option>
          <option value="FATHER">Father</option>
          <option value="MOTHER">Mother</option>
          <option value="GUARDIAN">Guardian</option>
          <option value="OTHER">Other</option>
        </select>
      </div>
      <div className="space-y-2">
        <Button type="submit" disabled={pending} className="w-full">
          <Link2 className="size-4" />
          {pending ? "Linking..." : "Link child"}
        </Button>
      </div>
      {state.status === "error" && state.message ? (
        <p role="alert" className="text-destructive text-sm sm:col-span-4">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
