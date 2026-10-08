"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type MarkableClass = {
  id: string;
  name: string;
  sections: { id: string; name: string }[];
};

const selectClass = cn(
  "border-input dark:bg-input/30 h-9 w-full rounded-md border bg-transparent px-2 text-sm shadow-xs outline-none",
  "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
);

/**
 * Selects the class, section, and date to take attendance for. Navigation is
 * driven through the URL query string so the roster (a server component) can
 * read the selection and the choice survives a refresh or shared link.
 */
export function AttendancePicker({
  classes,
  selectedClassId,
  selectedSectionId,
  date,
}: {
  classes: MarkableClass[];
  selectedClassId: string;
  selectedSectionId: string;
  date: string;
}) {
  const router = useRouter();
  const [classId, setClassId] = useState(selectedClassId);
  const [sectionId, setSectionId] = useState(selectedSectionId);
  const [day, setDay] = useState(date);

  const sections = classes.find((c) => c.id === classId)?.sections ?? [];

  function load(e: React.FormEvent) {
    e.preventDefault();
    if (!classId) return;
    const params = new URLSearchParams({ classId, date: day });
    if (sectionId) params.set("sectionId", sectionId);
    router.push(`/attendance?${params.toString()}`);
  }

  return (
    <form onSubmit={load} className="grid items-end gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div className="space-y-2">
        <Label htmlFor="att-class">Class</Label>
        <select
          id="att-class"
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
        <Label htmlFor="att-section">
          Section <span className="text-muted-foreground font-normal">(optional)</span>
        </Label>
        <select
          id="att-section"
          value={sectionId}
          onChange={(e) => setSectionId(e.target.value)}
          disabled={sections.length === 0}
          className={selectClass}
        >
          <option value="">{sections.length === 0 ? "No sections" : "All sections"}</option>
          {sections.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="att-date">Date</Label>
        <Input
          id="att-date"
          type="date"
          value={day}
          onChange={(e) => setDay(e.target.value)}
          max={new Date().toISOString().slice(0, 10)}
        />
      </div>

      <Button type="submit" disabled={!classId}>
        Load roster
      </Button>
    </form>
  );
}
