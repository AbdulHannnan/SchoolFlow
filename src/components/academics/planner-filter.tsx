"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type Teacher = { id: string; name: string };
type Mode = "range" | "day";

/**
 * The HEAD's planner filter. A teacher picker plus a mode switcher that decides
 * which date filter is active: a from/to range, or a single day. Only the
 * active mode's inputs are rendered, so a plain GET submit carries exactly the
 * right params (`mode` + `from`/`to` or `date`). The server reads `mode` to know
 * which applies. Switching mode just swaps the inputs; the list updates on Apply.
 */
export function PlannerFilter({
  mode: initialMode,
  from,
  to,
  date,
  today,
  teacherId,
  teachers,
}: {
  mode: Mode;
  from: string;
  to: string;
  date: string;
  today: string;
  teacherId: string;
  teachers: Teacher[];
}) {
  const [mode, setMode] = useState<Mode>(initialMode);

  const selectClass = cn(
    "border-input dark:bg-input/30 h-9 w-full rounded-md border bg-transparent px-2 text-sm shadow-xs outline-none",
    "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
  );

  return (
    <form method="get" className="flex flex-wrap items-end gap-3">
      {/* The server keys off this to pick the range vs. single-day filter. */}
      <input type="hidden" name="mode" value={mode} />

      <div className="space-y-1">
        <Label htmlFor="planner-teacher" className="text-xs">
          Teacher
        </Label>
        <select
          id="planner-teacher"
          name="teacherId"
          defaultValue={teacherId}
          className={cn(selectClass, "w-44")}
        >
          <option value="">All teachers</option>
          {teachers.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1">
        <Label className="text-xs">Filter by</Label>
        <div
          role="group"
          aria-label="Date filter mode"
          className="border-input inline-flex h-9 items-center rounded-md border p-0.5"
        >
          <ModeButton active={mode === "range"} onClick={() => setMode("range")}>
            Date range
          </ModeButton>
          <ModeButton active={mode === "day"} onClick={() => setMode("day")}>
            Single day
          </ModeButton>
        </div>
      </div>

      {mode === "range" ? (
        <>
          <div className="space-y-1">
            <Label htmlFor="planner-from" className="text-xs">
              From
            </Label>
            <Input
              id="planner-from"
              name="from"
              type="date"
              defaultValue={from}
              max={today}
              className="w-40"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="planner-to" className="text-xs">
              To
            </Label>
            <Input
              id="planner-to"
              name="to"
              type="date"
              defaultValue={to}
              max={today}
              className="w-40"
            />
          </div>
        </>
      ) : (
        <div className="space-y-1">
          <Label htmlFor="planner-date" className="text-xs">
            Date
          </Label>
          <Input
            id="planner-date"
            name="date"
            type="date"
            defaultValue={date}
            max={today}
            className="w-40"
          />
        </div>
      )}

      <Button type="submit" variant="outline">
        Apply
      </Button>
    </form>
  );
}

function ModeButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "h-8 rounded-sm px-3 text-sm transition-colors",
        active
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
