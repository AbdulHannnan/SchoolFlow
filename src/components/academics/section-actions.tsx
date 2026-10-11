"use client";

import { useState, useTransition } from "react";
import { MoreVertical, Pencil, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { deleteSectionAction, updateSectionAction } from "@/app/classes/actions";
import { initialFormState, type FormState } from "@/app/classes/form-state";

type TeacherOption = { id: string; name: string };

const selectClass =
  "border-input dark:bg-input/30 h-9 w-full rounded-md border bg-transparent px-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]";

/**
 * Per-section actions: a three-dots menu with Edit and Delete. Edit opens a
 * modal to change the section name and its section teacher. Student count is
 * read-only (derived from enrolled students). Mirrors ClassActions.
 */
export function SectionActions({
  id,
  name,
  sectionTeacherId,
  teachers,
}: {
  id: string;
  name: string;
  sectionTeacherId: string | null;
  teachers: TeacherOption[];
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [state, setState] = useState<FormState>(initialFormState);
  const [pending, startTransition] = useTransition();
  const errors = state.fieldErrors ?? {};

  function openEditor() {
    setState(initialFormState);
    setEditing(true);
    setMenuOpen(false);
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await updateSectionAction(state, formData);
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
        aria-label={`Actions for section ${name}`}
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
            className="bg-popover text-popover-foreground absolute right-0 z-20 mt-1 w-36 rounded-md border p-1 shadow-md"
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
            <form
              action={deleteSectionAction}
              onSubmit={(e) => {
                if (!confirm(`Delete section ${name}? This cannot be undone.`)) e.preventDefault();
              }}
            >
              <input type="hidden" name="id" value={id} />
              <button
                type="submit"
                role="menuitem"
                className="text-destructive hover:bg-accent flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm"
              >
                <Trash2 className="size-4" />
                Delete
              </button>
            </form>
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
          <div className="bg-card text-card-foreground relative z-10 w-full max-w-md rounded-xl border p-6 shadow-lg">
            <h2 className="text-base font-semibold">Edit section</h2>
            <form onSubmit={onSubmit} className="mt-4 space-y-4">
              <input type="hidden" name="id" value={id} />
              <div className="space-y-2">
                <Label htmlFor={`edit-section-name-${id}`}>Section name</Label>
                <Input
                  id={`edit-section-name-${id}`}
                  name="name"
                  defaultValue={name}
                  required
                  aria-invalid={!!errors.name}
                />
                {errors.name ? <p className="text-destructive text-xs">{errors.name}</p> : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor={`edit-section-teacher-${id}`}>
                  Section teacher{" "}
                  <span className="text-muted-foreground font-normal">(optional)</span>
                </Label>
                <select
                  id={`edit-section-teacher-${id}`}
                  name="sectionTeacherId"
                  defaultValue={sectionTeacherId ?? ""}
                  className={selectClass}
                >
                  <option value="">No section teacher</option>
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
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
