"use client";

import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { savePaperResultsAction } from "@/app/exams/actions";
import { initialFormState } from "@/app/exams/form-state";

type RosterRow = {
  studentId: string;
  name: string;
  rollNumber: string | null;
  section: { name: string } | null;
  marksObtained: string;
  isAbsent: boolean;
};

/**
 * Marks-entry grid for one exam paper. Each row submits the student id, their
 * marks (`marks_<id>`) and an absent flag (`absent_<id>`); marking a student
 * absent disables and clears their marks input. Saving is idempotent, so the
 * sheet can be re-saved freely.
 */
export function EnterResultsForm({
  examSubjectId,
  maxMarks,
  roster,
}: {
  examSubjectId: string;
  maxMarks: string;
  roster: RosterRow[];
}) {
  const [state, action, pending] = useActionState(savePaperResultsAction, initialFormState);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="examSubjectId" value={examSubjectId} />

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-muted-foreground text-xs">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Roll</th>
              <th className="px-3 py-2 text-left font-medium">Student</th>
              <th className="px-3 py-2 text-left font-medium">Marks (out of {maxMarks})</th>
              <th className="px-3 py-2 text-left font-medium">Absent</th>
            </tr>
          </thead>
          <tbody className="divide-border divide-y">
            {roster.map((r) => (
              <ResultRow key={r.studentId} row={r} />
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending || roster.length === 0}>
          {pending ? "Saving..." : "Save results"}
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

function ResultRow({ row }: { row: RosterRow }) {
  const [absent, setAbsent] = useState(row.isAbsent);

  return (
    <tr>
      <td className="text-muted-foreground px-3 py-2">{row.rollNumber ?? "—"}</td>
      <td className="px-3 py-2">
        {row.name}
        {row.section ? (
          <span className="text-muted-foreground ml-2 text-xs">{row.section.name}</span>
        ) : null}
      </td>
      <td className="px-3 py-2">
        <input type="hidden" name="studentId" value={row.studentId} />
        <Input
          name={`marks_${row.studentId}`}
          inputMode="decimal"
          defaultValue={row.marksObtained}
          disabled={absent}
          placeholder={absent ? "Absent" : ""}
          className="h-8 w-28"
          aria-label={`Marks for ${row.name}`}
        />
      </td>
      <td className="px-3 py-2">
        <input
          type="checkbox"
          name={`absent_${row.studentId}`}
          checked={absent}
          onChange={(e) => setAbsent(e.target.checked)}
          className="size-4"
          aria-label={`Mark ${row.name} absent`}
        />
      </td>
    </tr>
  );
}
