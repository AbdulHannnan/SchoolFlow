"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

const selectClass = cn(
  "border-input dark:bg-input/30 h-9 w-full rounded-md border bg-transparent px-2 text-sm shadow-xs outline-none",
  "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
);

/**
 * Chooses the class whose students' progress to review. Navigation goes through
 * the URL query string so the server-rendered roster reads the selection.
 */
export function ProgressClassPicker({
  classes,
  selectedClassId,
}: {
  classes: { id: string; name: string }[];
  selectedClassId: string;
}) {
  const router = useRouter();
  const [classId, setClassId] = useState(selectedClassId);

  function load(e: React.FormEvent) {
    e.preventDefault();
    if (!classId) return;
    router.push(`/progress?classId=${encodeURIComponent(classId)}`);
  }

  return (
    <form onSubmit={load} className="grid items-end gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <div className="space-y-2">
        <Label htmlFor="progress-class">Class</Label>
        <select
          id="progress-class"
          value={classId}
          onChange={(e) => setClassId(e.target.value)}
          className={selectClass}
        >
          <option value="" disabled>
            Select class...
          </option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <Button type="submit" disabled={!classId}>
        Open
      </Button>
    </form>
  );
}
