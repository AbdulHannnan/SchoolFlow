"use client";

import { Check, RotateCcw } from "lucide-react";
import type { PlannerStatus } from "@prisma/client";

import { Button } from "@/components/ui/button";
import { setPlannerStatusAction } from "@/app/planner/actions";

/**
 * Toggles one of the teacher's own plans between PLANNED and COMPLETED. Posts
 * the desired next status to the Server Action (which scopes the update to the
 * owner), so the button flips the current state.
 */
export function PlannerStatusToggle({ id, status }: { id: string; status: PlannerStatus }) {
  const done = status === "COMPLETED";
  const next: PlannerStatus = done ? "PLANNED" : "COMPLETED";

  return (
    <form action={setPlannerStatusAction}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={next} />
      <Button type="submit" variant="outline" size="sm">
        {done ? (
          <>
            <RotateCcw className="size-3.5" /> Reopen
          </>
        ) : (
          <>
            <Check className="size-3.5" /> Mark taught
          </>
        )}
      </Button>
    </form>
  );
}
