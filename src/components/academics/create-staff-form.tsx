"use client";

import { useActionState, useEffect, useRef } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createStaffAction } from "@/app/staff/actions";
import { initialFormState } from "@/app/staff/form-state";
import { SUPPORT_STAFF_ROLES, SUPPORT_STAFF_ROLE_LABELS } from "@/lib/staff";

const selectClass =
  "border-input dark:bg-input/30 h-9 w-full rounded-md border bg-transparent px-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]";

export function CreateStaffForm() {
  const [state, action, pending] = useActionState(createStaffAction, initialFormState);
  const formRef = useRef<HTMLFormElement>(null);
  const errors = state.fieldErrors ?? {};

  useEffect(() => {
    // DOM reset only (selects return to their defaults); no React state to clear.
    if (state.status === "success") formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={action} className="grid gap-4 sm:grid-cols-3">
      <div className="space-y-2">
        <Label htmlFor="staff-name">Full name</Label>
        <Input id="staff-name" name="name" required aria-invalid={!!errors.name} />
        {errors.name ? <p className="text-destructive text-xs">{errors.name}</p> : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="staff-role">Role</Label>
        <select id="staff-role" name="role" defaultValue="DRIVER" className={selectClass}>
          {SUPPORT_STAFF_ROLES.map((r) => (
            <option key={r} value={r}>
              {SUPPORT_STAFF_ROLE_LABELS[r]}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="staff-custom-role">
          Role name{" "}
          <span className="text-muted-foreground font-normal">(only for &quot;Other&quot;)</span>
        </Label>
        <Input
          id="staff-custom-role"
          name="customRole"
          placeholder="e.g. Lab attendant"
          aria-invalid={!!errors.customRole}
        />
        {errors.customRole ? <p className="text-destructive text-xs">{errors.customRole}</p> : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="staff-phone">
          Phone <span className="text-muted-foreground font-normal">(optional)</span>
        </Label>
        <Input id="staff-phone" name="phone" inputMode="tel" aria-invalid={!!errors.phone} />
        {errors.phone ? <p className="text-destructive text-xs">{errors.phone}</p> : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="staff-cnic">
          CNIC <span className="text-muted-foreground font-normal">(optional)</span>
        </Label>
        <Input
          id="staff-cnic"
          name="cnic"
          inputMode="numeric"
          placeholder="13 digits"
          aria-invalid={!!errors.cnic}
        />
        {errors.cnic ? <p className="text-destructive text-xs">{errors.cnic}</p> : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="staff-joining">
          Joining date <span className="text-muted-foreground font-normal">(optional)</span>
        </Label>
        <Input id="staff-joining" name="joiningDate" type="date" />
      </div>

      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="staff-address">
          Address <span className="text-muted-foreground font-normal">(optional)</span>
        </Label>
        <Input id="staff-address" name="address" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="staff-salary">
          Monthly salary (PKR) <span className="text-muted-foreground font-normal">(optional)</span>
        </Label>
        <Input
          id="staff-salary"
          name="monthlySalary"
          inputMode="decimal"
          placeholder="e.g. 25000"
          aria-invalid={!!errors.monthlySalary}
        />
        {errors.monthlySalary ? (
          <p className="text-destructive text-xs">{errors.monthlySalary}</p>
        ) : null}
      </div>

      {state.status === "error" && state.message && !state.fieldErrors ? (
        <p role="alert" className="text-destructive text-sm sm:col-span-3">
          {state.message}
        </p>
      ) : null}

      <div className="sm:col-span-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Adding..." : "Add staff member"}
        </Button>
      </div>
    </form>
  );
}
