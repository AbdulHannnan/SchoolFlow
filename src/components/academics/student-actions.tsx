"use client";

import { useMemo, useState, useTransition } from "react";
import { MoreVertical, Pencil } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ClassOption } from "@/components/academics/create-student-form";
import { updateStudentAction } from "@/app/students/actions";
import { initialFormState, type FormState } from "@/app/students/form-state";

type Student = {
  id: string;
  name: string;
  rollNumber: string | null;
  fatherName: string | null;
  fatherCnic: string | null;
  gender: "MALE" | "FEMALE" | "OTHER" | null;
  dateOfBirth: Date | null;
  admissionDate: Date | null;
  isActive: boolean;
  section: { id: string; name: string } | null;
};

const selectClass =
  "border-input dark:bg-input/30 h-9 w-full rounded-md border bg-transparent px-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]";

/** "YYYY-MM-DD" for a date-only value, for an <input type="date"> default. */
function toDateInput(d: Date | null): string {
  return d ? new Date(d).toISOString().slice(0, 10) : "";
}

/**
 * Per-student three-dots menu with a single Edit action (there is no delete).
 * Edit opens a modal to change every field, including the enrolled status.
 */
export function StudentActions({
  student,
  classId,
  classes,
}: {
  student: Student;
  classId: string;
  classes: ClassOption[];
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [selectedClassId, setSelectedClassId] = useState(classId);
  const [state, setState] = useState<FormState>(initialFormState);
  const [pending, startTransition] = useTransition();
  const errors = state.fieldErrors ?? {};

  const sections = useMemo(
    () => classes.find((c) => c.id === selectedClassId)?.sections ?? [],
    [classes, selectedClassId],
  );

  function openEditor() {
    setState(initialFormState);
    setSelectedClassId(classId);
    setEditing(true);
    setMenuOpen(false);
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await updateStudentAction(state, formData);
      setState(result);
      if (result.status === "success") setEditing(false);
    });
  }

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="icon"
        className="size-7"
        aria-label={`Actions for ${student.name}`}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen((o) => !o)}
      >
        <MoreVertical className="size-4" />
      </Button>

      {menuOpen ? (
        <>
          <button
            type="button"
            aria-hidden
            tabIndex={-1}
            className="fixed inset-0 z-10 cursor-default"
            onClick={() => setMenuOpen(false)}
          />
          <div
            role="menu"
            className="bg-popover text-popover-foreground absolute right-0 z-20 mt-1 w-32 rounded-md border p-1 shadow-md"
          >
            <button
              type="button"
              role="menuitem"
              className="hover:bg-accent hover:text-accent-foreground flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm"
              onClick={openEditor}
            >
              <Pencil className="size-4" />
              Edit
            </button>
          </div>
        </>
      ) : null}

      {editing ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Close"
            className="absolute inset-0 bg-black/50"
            onClick={() => setEditing(false)}
          />
          <div className="bg-card text-card-foreground relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border p-6 shadow-lg">
            <h2 className="text-base font-semibold">Edit student</h2>
            <form onSubmit={onSubmit} className="mt-4 space-y-4">
              <input type="hidden" name="id" value={student.id} />

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor={`st-name-${student.id}`}>Full name</Label>
                  <Input
                    id={`st-name-${student.id}`}
                    name="name"
                    defaultValue={student.name}
                    required
                    aria-invalid={!!errors.name}
                  />
                  {errors.name ? <p className="text-destructive text-xs">{errors.name}</p> : null}
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`st-roll-${student.id}`}>
                    Roll number{" "}
                    <span className="text-muted-foreground font-normal">(optional)</span>
                  </Label>
                  <Input
                    id={`st-roll-${student.id}`}
                    name="rollNumber"
                    defaultValue={student.rollNumber ?? ""}
                    aria-invalid={!!errors.rollNumber}
                  />
                  {errors.rollNumber ? (
                    <p className="text-destructive text-xs">{errors.rollNumber}</p>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`st-father-${student.id}`}>
                    Father name{" "}
                    <span className="text-muted-foreground font-normal">(optional)</span>
                  </Label>
                  <Input
                    id={`st-father-${student.id}`}
                    name="fatherName"
                    defaultValue={student.fatherName ?? ""}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`st-cnic-${student.id}`}>
                    Father CNIC{" "}
                    <span className="text-muted-foreground font-normal">(optional)</span>
                  </Label>
                  <Input
                    id={`st-cnic-${student.id}`}
                    name="fatherCnic"
                    inputMode="numeric"
                    defaultValue={student.fatherCnic ?? ""}
                    aria-invalid={!!errors.fatherCnic}
                  />
                  {errors.fatherCnic ? (
                    <p className="text-destructive text-xs">{errors.fatherCnic}</p>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`st-class-${student.id}`}>Class</Label>
                  <select
                    id={`st-class-${student.id}`}
                    name="classId"
                    required
                    value={selectedClassId}
                    onChange={(e) => setSelectedClassId(e.target.value)}
                    className={selectClass}
                  >
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`st-section-${student.id}`}>
                    Section <span className="text-muted-foreground font-normal">(optional)</span>
                  </Label>
                  <select
                    id={`st-section-${student.id}`}
                    name="sectionId"
                    defaultValue={student.section?.id ?? ""}
                    disabled={sections.length === 0}
                    className={selectClass}
                  >
                    <option value="">{sections.length === 0 ? "No sections" : "Unassigned"}</option>
                    {sections.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                  {errors.sectionId ? (
                    <p className="text-destructive text-xs">{errors.sectionId}</p>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`st-gender-${student.id}`}>
                    Gender <span className="text-muted-foreground font-normal">(optional)</span>
                  </Label>
                  <select
                    id={`st-gender-${student.id}`}
                    name="gender"
                    defaultValue={student.gender ?? ""}
                    className={selectClass}
                  >
                    <option value="">-</option>
                    <option value="MALE">Male</option>
                    <option value="FEMALE">Female</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`st-dob-${student.id}`}>
                    Date of birth{" "}
                    <span className="text-muted-foreground font-normal">(optional)</span>
                  </Label>
                  <Input
                    id={`st-dob-${student.id}`}
                    name="dateOfBirth"
                    type="date"
                    defaultValue={toDateInput(student.dateOfBirth)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`st-admission-${student.id}`}>
                    Admission date{" "}
                    <span className="text-muted-foreground font-normal">(optional)</span>
                  </Label>
                  <Input
                    id={`st-admission-${student.id}`}
                    name="admissionDate"
                    type="date"
                    defaultValue={toDateInput(student.admissionDate)}
                  />
                </div>
              </div>

              <label
                htmlFor={`st-active-${student.id}`}
                className="flex items-center gap-2 text-sm"
              >
                <input
                  id={`st-active-${student.id}`}
                  type="checkbox"
                  name="isActive"
                  defaultChecked={student.isActive}
                  className="size-4"
                />
                Enrolled
              </label>

              {state.status === "error" && state.message ? (
                <p role="alert" className="text-destructive text-sm">
                  {state.message}
                </p>
              ) : null}

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setEditing(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={pending}>
                  {pending ? "Saving..." : "Save changes"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
