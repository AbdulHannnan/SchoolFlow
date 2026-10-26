import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { formatDay } from "@/lib/attendance";
import { ageFromDob, formatCnic, genderLabel } from "@/lib/students";
import type { listStudentsByClass } from "@/server/academics/students";

/** A roster row, shaped by the class-roster reads so the two stay in step. */
export type RosterStudent = Awaited<ReturnType<typeof listStudentsByClass>>["students"][number];

function Detail({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value ?? "-"}</dd>
    </div>
  );
}

/**
 * The per-class student list with full details, shared by the HEAD roster and
 * the teacher's read-only class view so both show students the same way.
 * `actions`, when given, renders the per-row controls on the right (HEAD gets
 * edit/attendance; a teacher passes nothing for a read-only list).
 */
export function StudentRosterList({
  students,
  actions,
}: {
  students: RosterStudent[];
  actions?: (student: RosterStudent) => ReactNode;
}) {
  if (students.length === 0) {
    return <p className="text-muted-foreground text-sm">No students in this class yet.</p>;
  }

  return (
    <ul className="space-y-3">
      {students.map((student) => (
        <li key={student.id} className="rounded-lg border p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">
                {student.name}
                {student.rollNumber ? (
                  <span className="text-muted-foreground ml-2 font-normal">
                    #{student.rollNumber}
                  </span>
                ) : null}
              </div>
              <div className="text-muted-foreground mt-0.5 flex items-center gap-1.5 text-xs">
                {student.section ? (
                  <Badge variant="secondary" className="px-1.5 py-0">
                    {student.section.name}
                  </Badge>
                ) : (
                  <span className="italic">no section</span>
                )}
                <Badge
                  variant="outline"
                  className={
                    student.isActive
                      ? "border-transparent bg-green-100 px-1.5 py-0 text-green-700 dark:bg-green-900/40 dark:text-green-400"
                      : "border-transparent bg-neutral-200 px-1.5 py-0 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400"
                  }
                >
                  {student.isActive ? "Enrolled" : "Not enrolled"}
                </Badge>
              </div>
            </div>
            {actions ? <div className="flex items-center gap-3">{actions(student)}</div> : null}
          </div>
          <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-3">
            <Detail label="Father" value={student.fatherName} />
            <Detail
              label="Father CNIC"
              value={student.fatherCnic ? formatCnic(student.fatherCnic) : null}
            />
            <Detail label="Gender" value={genderLabel(student.gender)} />
            <Detail
              label="Date of birth"
              value={student.dateOfBirth ? formatDay(student.dateOfBirth) : null}
            />
            <Detail
              label="Age"
              value={student.dateOfBirth ? `${ageFromDob(student.dateOfBirth)} yrs` : null}
            />
            <Detail
              label="Admission"
              value={student.admissionDate ? formatDay(student.admissionDate) : null}
            />
          </dl>
        </li>
      ))}
    </ul>
  );
}
