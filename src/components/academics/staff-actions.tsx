"use client";

import { useState, useTransition } from "react";
import { MoreVertical, Pencil } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DeleteButton } from "@/components/academics/delete-button";
import { deleteStaffAction, updateStaffAction } from "@/app/staff/actions";
import { initialFormState, type FormState } from "@/app/staff/form-state";
import { SUPPORT_STAFF_ROLES, SUPPORT_STAFF_ROLE_LABELS } from "@/lib/staff";
import type { StaffMemberView } from "@/server/academics/staff";

const selectClass =
  "border-input dark:bg-input/30 h-9 w-full rounded-md border bg-transparent px-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]";

/** "YYYY-MM-DD" for a date-only value, for an <input type="date"> default. */
function toDateInput(d: Date | null): string {
  return d ? new Date(d).toISOString().slice(0, 10) : "";
}

/**
 * Per-staff three-dots menu: Edit (opens a modal over every field) and Delete.
 */
export function StaffActions({ staff }: { staff: StaffMemberView }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [role, setRole] = useState(staff.role);
  const [state, setState] = useState<FormState>(initialFormState);
  const [pending, startTransition] = useTransition();
  const errors = state.fieldErrors ?? {};

  function openEditor() {
    setState(initialFormState);
    setRole(staff.role);
    setEditing(true);
    setMenuOpen(false);
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await updateStaffAction(state, formData);
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
        aria-label={`Actions for ${staff.name}`}
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
            className="bg-popover text-popover-foreground absolute right-0 z-20 mt-1 w-40 rounded-md border p-1 shadow-md"
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
            <div className="flex items-center justify-between px-2 py-1.5 text-sm">
              <span className="text-muted-foreground">Delete</span>
              <DeleteButton action={deleteStaffAction} id={staff.id} label={staff.name} />
            </div>
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
            <h2 className="text-base font-semibold">Edit staff member</h2>
            <form onSubmit={onSubmit} className="mt-4 space-y-4">
              <input type="hidden" name="id" value={staff.id} />

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor={`sf-name-${staff.id}`}>Full name</Label>
                  <Input
                    id={`sf-name-${staff.id}`}
                    name="name"
                    defaultValue={staff.name}
                    required
                    aria-invalid={!!errors.name}
                  />
                  {errors.name ? <p className="text-destructive text-xs">{errors.name}</p> : null}
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`sf-role-${staff.id}`}>Role</Label>
                  <select
                    id={`sf-role-${staff.id}`}
                    name="role"
                    value={role}
                    onChange={(e) => setRole(e.target.value as StaffMemberView["role"])}
                    className={selectClass}
                  >
                    {SUPPORT_STAFF_ROLES.map((r) => (
                      <option key={r} value={r}>
                        {SUPPORT_STAFF_ROLE_LABELS[r]}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor={`sf-custom-${staff.id}`}>
                    Role name{" "}
                    <span className="text-muted-foreground font-normal">
                      {role === "OTHER" ? "(required)" : "(for Other)"}
                    </span>
                  </Label>
                  <Input
                    id={`sf-custom-${staff.id}`}
                    name="customRole"
                    defaultValue={staff.customRole ?? ""}
                    disabled={role !== "OTHER"}
                    aria-invalid={!!errors.customRole}
                  />
                  {errors.customRole ? (
                    <p className="text-destructive text-xs">{errors.customRole}</p>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`sf-phone-${staff.id}`}>
                    Phone <span className="text-muted-foreground font-normal">(optional)</span>
                  </Label>
                  <Input
                    id={`sf-phone-${staff.id}`}
                    name="phone"
                    inputMode="tel"
                    defaultValue={staff.phone ?? ""}
                    aria-invalid={!!errors.phone}
                  />
                  {errors.phone ? <p className="text-destructive text-xs">{errors.phone}</p> : null}
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`sf-cnic-${staff.id}`}>
                    CNIC <span className="text-muted-foreground font-normal">(optional)</span>
                  </Label>
                  <Input
                    id={`sf-cnic-${staff.id}`}
                    name="cnic"
                    inputMode="numeric"
                    defaultValue={staff.cnic ?? ""}
                    aria-invalid={!!errors.cnic}
                  />
                  {errors.cnic ? <p className="text-destructive text-xs">{errors.cnic}</p> : null}
                </div>

                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor={`sf-address-${staff.id}`}>
                    Address <span className="text-muted-foreground font-normal">(optional)</span>
                  </Label>
                  <Input
                    id={`sf-address-${staff.id}`}
                    name="address"
                    defaultValue={staff.address ?? ""}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`sf-joining-${staff.id}`}>
                    Joining date{" "}
                    <span className="text-muted-foreground font-normal">(optional)</span>
                  </Label>
                  <Input
                    id={`sf-joining-${staff.id}`}
                    name="joiningDate"
                    type="date"
                    defaultValue={toDateInput(staff.joiningDate)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`sf-salary-${staff.id}`}>
                    Monthly salary (PKR){" "}
                    <span className="text-muted-foreground font-normal">(optional)</span>
                  </Label>
                  <Input
                    id={`sf-salary-${staff.id}`}
                    name="monthlySalary"
                    inputMode="decimal"
                    defaultValue={staff.monthlySalary ?? ""}
                    aria-invalid={!!errors.monthlySalary}
                  />
                  {errors.monthlySalary ? (
                    <p className="text-destructive text-xs">{errors.monthlySalary}</p>
                  ) : null}
                </div>
              </div>

              <label htmlFor={`sf-active-${staff.id}`} className="flex items-center gap-2 text-sm">
                <input
                  id={`sf-active-${staff.id}`}
                  type="checkbox"
                  name="isActive"
                  defaultChecked={staff.isActive}
                  className="size-4"
                />
                Currently employed
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
