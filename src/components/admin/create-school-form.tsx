"use client";

import * as React from "react";
import { useActionState } from "react";
import { CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createSchoolAction, initialCreateSchoolState } from "@/app/admin/actions";

/** Turn a school name into a URL-safe slug suggestion. */
function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function CreateSchoolForm() {
  const [state, action, pending] = useActionState(createSchoolAction, initialCreateSchoolState);

  // Auto-suggest the slug from the name until the user edits the slug directly.
  const [slug, setSlug] = React.useState("");
  const [slugTouched, setSlugTouched] = React.useState(false);

  const errors = state.fieldErrors ?? {};

  return (
    <form action={action} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="schoolName">School name</Label>
        <Input
          id="schoolName"
          name="schoolName"
          required
          aria-invalid={!!errors.schoolName}
          onChange={(e) => {
            if (!slugTouched) setSlug(slugify(e.target.value));
          }}
        />
        {errors.schoolName ? <FieldError>{errors.schoolName}</FieldError> : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="slug">
          Slug <span className="text-muted-foreground font-normal">(used to sign in)</span>
        </Label>
        <Input
          id="slug"
          name="slug"
          required
          value={slug}
          aria-invalid={!!errors.slug}
          onChange={(e) => {
            setSlugTouched(true);
            setSlug(e.target.value);
          }}
        />
        {errors.slug ? <FieldError>{errors.slug}</FieldError> : null}
      </div>

      <div className="border-t pt-4">
        <p className="text-sm font-medium">First HEAD account</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="headName">Full name</Label>
        <Input id="headName" name="headName" required aria-invalid={!!errors.headName} />
        {errors.headName ? <FieldError>{errors.headName}</FieldError> : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="headEmail">Email</Label>
        <Input
          id="headEmail"
          name="headEmail"
          type="email"
          required
          aria-invalid={!!errors.headEmail}
        />
        {errors.headEmail ? <FieldError>{errors.headEmail}</FieldError> : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="headPassword">Temporary password</Label>
        <Input
          id="headPassword"
          name="headPassword"
          type="password"
          required
          aria-invalid={!!errors.headPassword}
        />
        {errors.headPassword ? <FieldError>{errors.headPassword}</FieldError> : null}
      </div>

      {state.status === "error" && state.message ? (
        <p role="alert" className="text-destructive text-sm">
          {state.message}
        </p>
      ) : null}

      {state.status === "success" ? (
        <div className="border-primary/20 bg-primary/5 flex items-start gap-2 rounded-md border p-3 text-sm">
          <CheckCircle2 className="text-primary mt-0.5 size-4 shrink-0" />
          <span>
            {state.message} School slug: <code className="font-medium">{state.createdSlug}</code>
          </span>
        </div>
      ) : null}

      <Button type="submit" disabled={pending}>
        {pending ? "Creating…" : "Create school"}
      </Button>
    </form>
  );
}

function FieldError({ children }: { children: React.ReactNode }) {
  return <p className="text-destructive text-xs">{children}</p>;
}
