import { Badge } from "@/components/ui/badge";
import { ATTENDANCE_STATUS, statusBadgeClass } from "@/lib/attendance";
import type { StatusCounts } from "@/server/academics/attendance";

/** A compact row of per-status counts plus the present rate for a period. */
export function AttendanceSummary({ counts }: { counts: StatusCounts }) {
  const rate = counts.total > 0 ? Math.round((counts.PRESENT / counts.total) * 100) : null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {ATTENDANCE_STATUS.map((s) => (
        <Badge key={s.value} className={statusBadgeClass(s.value)}>
          {s.label} {counts[s.value]}
        </Badge>
      ))}
      <span className="text-muted-foreground text-xs">
        {counts.total} marked{rate !== null ? ` - ${rate}% present` : ""}
      </span>
    </div>
  );
}
