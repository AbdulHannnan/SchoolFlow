"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import type { ClassProgressCard } from "@/server/academics/class-progress";
import { monthLabel } from "@/lib/attendance";
import { formatPKR } from "@/lib/money";

/**
 * The all-classes comparison chart (Module 7.4). A single-series column chart
 * whose metric the HEAD switches with a filter - attendance, red flags, fees
 * collected, and more as they are added. Only one metric shows at a time, so
 * each can own its own scale and unit; identity is the class axis, named by the
 * title, so one hue (no legend). Client-side so the filter is instant - the data
 * for every metric already arrives with the page.
 *
 * Adding a metric: give `ClassProgressCard` the field, then add one `METRICS`
 * entry here. Nothing else changes.
 */

const selectClass = cn(
  "border-input dark:bg-input/30 h-9 rounded-md border bg-transparent px-2 text-sm shadow-xs outline-none",
  "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
);

/** Below this attendance present-rate a class reads as a concern. */
const LOW_ATTENDANCE = 75;

type Unit = "percent" | "count" | "currency";

type MetricDef = {
  key: string;
  label: string;
  unit: Unit;
  value: (c: ClassProgressCard) => number | null;
  /** A dashed target line (percent metrics only). */
  target?: number;
  /** Tint a bar destructive when it sits below `target`. */
  lowIsBad?: boolean;
};

const METRICS: MetricDef[] = [
  {
    key: "attendance",
    label: "Average attendance",
    unit: "percent",
    value: (c) => c.presentRate,
    target: LOW_ATTENDANCE,
    lowIsBad: true,
  },
  { key: "redFlags", label: "Open red flags", unit: "count", value: (c) => c.openFlags },
  { key: "fees", label: "Fees submitted", unit: "currency", value: (c) => c.feesCollected },
];

/** Short label for a bar (currency compacted so it fits above the column). */
function shortValue(value: number | null, unit: Unit): string {
  if (value === null) return "—";
  if (unit === "percent") return `${value}%`;
  if (unit === "currency") return compactPKR(value);
  return String(value);
}

function compactPKR(n: number): string {
  if (n >= 1_000_000) return `${+(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${+(n / 1_000).toFixed(1)}k`;
  return String(Math.round(n));
}

function fullValue(value: number | null, unit: Unit): string {
  if (value === null) return "no data";
  if (unit === "percent") return `${value}% present`;
  if (unit === "currency") return formatPKR(value);
  return `${value}`;
}

function caption(def: MetricDef, month: string): string {
  switch (def.key) {
    case "attendance":
      return `Present-rate for ${monthLabel(month)}. The dashed line marks the ${LOW_ATTENDANCE}% target.`;
    case "redFlags":
      return "Open red flags per class.";
    case "fees":
      return `Fees collected in ${monthLabel(month)}.`;
    default:
      return "";
  }
}

export function ClassComparisonChart({
  classes,
  month,
}: {
  classes: ClassProgressCard[];
  month: string;
}) {
  const [metricKey, setMetricKey] = useState(METRICS[0].key);
  const def = METRICS.find((m) => m.key === metricKey) ?? METRICS[0];

  if (classes.length === 0) return null;

  const values = classes.map(def.value);
  const maxVal =
    def.unit === "percent" ? 100 : Math.max(1, ...values.map((v) => (v === null ? 0 : v)));

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">{def.label} by class</CardTitle>
            <p className="text-muted-foreground text-sm">{caption(def, month)}</p>
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="chart-metric" className="text-muted-foreground text-sm">
              Show
            </Label>
            <select
              id="chart-metric"
              value={metricKey}
              onChange={(e) => setMetricKey(e.target.value)}
              className={selectClass}
            >
              {METRICS.map((m) => (
                <option key={m.key} value={m.key}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto pb-1">
          <div className="flex items-end gap-3" role="img" aria-label={`${def.label} by class`}>
            {classes.map((c) => {
              const value = def.value(c);
              const low = !!def.lowIsBad && value !== null && value < (def.target ?? 0);
              const height = value === null ? 0 : (value / maxVal) * 100;
              return (
                <div key={c.classId} className="flex w-16 shrink-0 flex-col items-center gap-1.5">
                  <span
                    className={`text-xs tabular-nums ${
                      low ? "text-destructive font-medium" : "text-muted-foreground"
                    }`}
                  >
                    {shortValue(value, def.unit)}
                  </span>
                  <div
                    className="bg-muted/50 relative flex h-36 w-full items-end overflow-hidden rounded"
                    title={`${c.name}: ${fullValue(value, def.unit)}`}
                  >
                    {def.unit === "percent" && def.target ? (
                      <div
                        className="border-border pointer-events-none absolute inset-x-0 border-t border-dashed"
                        style={{ bottom: `${def.target}%` }}
                      />
                    ) : null}
                    {value !== null ? (
                      <div
                        className={`w-full rounded-t ${low ? "bg-destructive" : "bg-primary"}`}
                        style={{ height: `${height}%` }}
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
