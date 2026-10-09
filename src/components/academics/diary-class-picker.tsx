"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export type PostableClass = {
  id: string;
  name: string;
  sections: { id: string; name: string }[];
};

const selectClass = cn(
  "border-input dark:bg-input/30 h-9 w-full rounded-md border bg-transparent px-2 text-sm shadow-xs outline-none",
  "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
);

/**
 * Chooses the class (and optional section) a diary entry targets. Navigation
 * goes through the URL query string so the post form and recent-entries list
 * (server components) read the selection and it survives a refresh/shared link.
 */
export function DiaryClassPicker({
  classes,
  selectedClassId,
  selectedSectionId,
}: {
  classes: PostableClass[];
  selectedClassId: string;
  selectedSectionId: string;
}) {
  const router = useRouter();
  const [classId, setClassId] = useState(selectedClassId);
  const [sectionId, setSectionId] = useState(selectedSectionId);

  const sections = classes.find((c) => c.id === classId)?.sections ?? [];

  function load(e: React.FormEvent) {
    e.preventDefault();
    if (!classId) return;
    const params = new URLSearchParams({ classId });
    if (sectionId) params.set("sectionId", sectionId);
    router.push(`/homework?${params.toString()}`);
  }

  return (
    <form onSubmit={load} className="grid items-end gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <div className="space-y-2">
        <Label htmlFor="diary-class">Class</Label>
        <select
          id="diary-class"
          value={classId}
          onChange={(e) => {
            setClassId(e.target.value);
            setSectionId("");
          }}
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

      <div className="space-y-2">
        <Label htmlFor="diary-section">
          Section <span className="text-muted-foreground font-normal">(optional)</span>
        </Label>
        <select
          id="diary-section"
          value={sectionId}
          onChange={(e) => setSectionId(e.target.value)}
          disabled={sections.length === 0}
          className={selectClass}
        >
          <option value="">{sections.length === 0 ? "No sections" : "Whole class"}</option>
          {sections.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
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
