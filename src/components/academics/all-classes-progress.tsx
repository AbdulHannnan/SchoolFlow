import {
  CalendarCheck,
  ClipboardList,
  TriangleAlert,
  NotebookPen,
  GraduationCap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AllClassesProgress, ClassProgressCard } from "@/server/academics/class-progress";
import { CLASS_NOTE_TYPE_BADGE, CLASS_NOTE_TYPE_LABELS } from "@/lib/class-notes";
import { monthLabel } from "@/lib/attendance";

/**
 * The HEAD's all-classes progress overview (Module 7.4): a KPI row of school-
 * wide headline figures, then one card per class with attendance and exam-
 * average meters, open-flag count, and this month's class-note tally. Purely
 * presentational - the page fetches `getAllClassesProgress` and passes it in.
 */

/** Below this present-rate a class reads as a concern (matches the roster view). */
const LOW_ATTENDANCE = 75;

export function AllClassesProgress({ data }: { data: AllClassesProgress }) {
  const { totals, classes } = data;

  return (
    <div className="space-y-6">
      <ClassComparisonChart data={data} />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi
          icon={CalendarCheck}
          label="Avg attendance"
          value={totals.presentRate === null ? "—" : `${totals.presentRate}%`}
          hint="this month"
        />
        <Kpi
          icon={ClipboardList}
          label="Exam average"
          value={totals.examAverage === null ? "—" : `${totals.examAverage}%`}
          hint="published"
        />
        <Kpi
          icon={TriangleAlert}
          label="Open red flags"
          value={totals.openFlags}
          hint={`${totals.classes} classes`}
        />
        <Kpi
          icon={NotebookPen}
          label="Class notes"
          value={totals.notesThisMonth}
          hint="logged this month"
        />
      </div>

      {classes.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No classes yet. Add classes to see their progress here.
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {classes.map((c) => (
            <ClassCard key={c.classId} card={c} />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * A column chart comparing every class's attendance present-rate for the month
 * - the headline "how do the classes stack up" view. A single-series magnitude
 * chart, so one hue (identity is named by the title, not a legend); a column
 * tints to the destructive token when it falls below the 75% target, and the
 * value sits above every bar so a weak class reads without relying on color. A
 * dashed line marks the target. Scrolls sideways when there are many classes.
 */
function ClassComparisonChart({ data }: { data: AllClassesProgress }) {
  const { classes, month } = data;
  if (classes.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Attendance by class</CardTitle>
        <p className="text-muted-foreground text-sm">
          Present-rate for {monthLabel(month)}. The dashed line marks the 75% target.
        </p>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto pb-1">
          <div
            className="flex items-end gap-3"
            role="img"
            aria-label={`Attendance present-rate by class for ${monthLabel(month)}`}
          >
            {classes.map((c) => {
              const rate = c.presentRate;
              const low = rate !== null && rate < LOW_ATTENDANCE;
              return (
                <div key={c.classId} className="flex w-16 shrink-0 flex-col items-center gap-1.5">
                  <span
                    className={`text-xs tabular-nums ${
                      low ? "text-destructive font-medium" : "text-muted-foreground"
                    }`}
                  >
                    {rate === null ? "—" : `${rate}%`}
                  </span>
                  <div
                    className="bg-muted/50 relative flex h-36 w-full items-end overflow-hidden rounded"
                    title={`${c.name}: ${
                      rate === null ? "no attendance marked" : `${rate}% present`
                    }${c.markedRecords > 0 ? ` (${c.markedRecords} marked)` : ""}`}
                  >
                    <div
                      className="border-border pointer-events-none absolute inset-x-0 border-t border-dashed"
                      style={{ bottom: "75%" }}
                    />
                    {rate !== null ? (
                      <div
                        className={`w-full rounded-t ${low ? "bg-destructive" : "bg-primary"}`}
                        style={{ height: `${rate}%` }}
                      />
                    ) : null}
                  </div>
                  <span
                    className="text-muted-foreground w-full truncate text-center text-xs"
                    title={c.name}
                  >
                    {c.name}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <Card className="gap-2 py-4">
      <CardHeader className="px-4">
        <div className="text-muted-foreground flex items-center gap-2">
          <Icon className="size-4" />
          <span className="text-sm">{label}</span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-semibold tabular-nums">{value}</span>
          {hint ? <span className="text-muted-foreground text-xs">{hint}</span> : null}
        </div>
      </CardHeader>
    </Card>
  );
}

function ClassCard({ card }: { card: ClassProgressCard }) {
  const noteEntries = (
    Object.keys(CLASS_NOTE_TYPE_LABELS) as (keyof typeof CLASS_NOTE_TYPE_LABELS)[]
  ).filter((type) => card.notes[type] > 0);

  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="text-base">{card.name}</CardTitle>
          <span className="text-muted-foreground flex items-center gap-1 text-xs">
            <GraduationCap className="size-3.5" />
            {card.students} student{card.students === 1 ? "" : "s"}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Meter
          label="Attendance"
          rate={card.presentRate}
          caption={card.markedRecords > 0 ? `${card.markedRecords} marked` : "none marked"}
          low={card.presentRate !== null && card.presentRate < LOW_ATTENDANCE}
        />
        <Meter label="Exam average" rate={card.examAverage} caption="published" />

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span
            className={
              card.openFlags > 0
                ? "inline-flex items-center gap-1 rounded-md border-transparent bg-red-100 px-2 py-1 text-xs text-red-700 dark:bg-red-900/40 dark:text-red-400"
                : "text-muted-foreground inline-flex items-center gap-1 text-xs"
            }
          >
            <TriangleAlert className="size-3.5" />
            {card.openFlags} flag{card.openFlags === 1 ? "" : "s"}
          </span>
          {noteEntries.map((type) => (
            <span
              key={type}
              className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs ${CLASS_NOTE_TYPE_BADGE[type]}`}
            >
              {CLASS_NOTE_TYPE_LABELS[type]}
              <span className="font-medium tabular-nums">{card.notes[type]}</span>
            </span>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * A horizontal magnitude meter for a 0-100 rate. The number is always shown
 * (identity is never color-alone); the fill tints to the destructive token only
 * when `low` is set, so a weak class reads at a glance without a legend.
 */
function Meter({
  label,
  rate,
  caption,
  low = false,
}: {
  label: string;
  rate: number | null;
  caption?: string;
  low?: boolean;
}) {
  const width = rate === null ? 0 : Math.max(0, Math.min(100, rate));
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className={`tabular-nums ${low ? "text-destructive font-medium" : ""}`}>
          {rate === null ? "—" : `${rate}%`}
          {caption ? <span className="text-muted-foreground ml-1 text-xs">({caption})</span> : null}
        </span>
      </div>
      <div
        className="bg-muted h-2 w-full overflow-hidden rounded-full"
        role="img"
        aria-label={`${label}: ${rate === null ? "no data" : `${rate} percent`}`}
      >
        <div
          className={`h-full rounded-full ${low ? "bg-destructive" : "bg-primary"}`}
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
}
