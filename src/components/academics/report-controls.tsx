"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { presetRange, type RangePreset } from "@/lib/attendance";
import type { MarkableClass } from "@/components/academics/attendance-picker";

const selectClass = cn(
  "border-input dark:bg-input/30 h-9 w-full rounded-md border bg-transparent px-2 text-sm shadow-xs outline-none",
  "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
);

/** Class/section + date-range selector for the attendance report (URL-driven). */
export function ReportControls({
  classes,
  selectedClassId,
  selectedSectionId,
  from,
  to,
}: {
  classes: MarkableClass[];
  selectedClassId: string;
  selectedSectionId: string;
  from: string;
  to: string;
}) {
  const router = useRouter();
  const [classId, setClassId] = useState(selectedClassId);
  const [sectionId, setSectionId] = useState(selectedSectionId);
  const [fromDate, setFromDate] = useState(from);
  const [toDate, setToDate] = useState(to);

  const sections = classes.find((c) => c.id === classId)?.sections ?? [];

  function push(c: string, s: string, f: string, t: string) {
    const params = new URLSearchParams({ classId: c, from: f, to: t });
    if (s) params.set("sectionId", s);
    router.push(`/attendance/report?${params.toString()}`);
  }

  function apply(e: React.FormEvent) {
    e.preventDefault();
    if (classId) push(classId, sectionId, fromDate, toDate);
  }

  function applyPreset(preset: RangePreset) {
    const range = presetRange(preset);
    setFromDate(range.from);
    setToDate(range.to);
    if (classId) push(classId, sectionId, range.from, range.to);
  }

  return (
    <form onSubmit={apply} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-2">
          <Label htmlFor="rep-class">Class</Label>
          <select
            id="rep-class"
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
          <Label htmlFor="rep-section">
            Section <span className="text-muted-foreground font-normal">(optional)</span>
          </Label>
          <select
            id="rep-section"
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
          <Label htmlFor="rep-from">From</Label>
          <Input
            id="rep-from"
            type="date"
            value={fromDate}
            max={toDate}
            onChange={(e) => setFromDate(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="rep-to">To</Label>
          <Input
            id="rep-to"
            type="date"
            value={toDate}
            min={fromDate}
            max={new Date().toISOString().slice(0, 10)}
            onChange={(e) => setToDate(e.target.value)}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" disabled={!classId}>
          Apply
        </Button>
        <span className="text-muted-foreground ml-2 text-xs">Quick range:</span>
        <Button type="button" variant="outline" size="sm" onClick={() => applyPreset("today")}>
          Today
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => applyPreset("week")}>
          This week
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => applyPreset("month")}>
          This month
        </Button>
      </div>
    </form>
  );
}
