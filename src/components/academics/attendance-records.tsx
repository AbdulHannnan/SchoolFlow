import type { AttendanceStatus } from "@prisma/client";

import { Badge } from "@/components/ui/badge";
import { formatAttendanceDate, statusBadgeClass, statusLabel } from "@/lib/attendance";

type AttendanceRecordItem = {
  id: string;
  date: Date;
  status: AttendanceStatus;
  note: string | null;
};

/** A dated list of one student's attendance records for a period. */
export function AttendanceRecords({ records }: { records: AttendanceRecordItem[] }) {
  if (records.length === 0) {
    return <p className="text-muted-foreground text-sm">No attendance recorded this month.</p>;
  }
  return (
    <ul className="divide-border divide-y">
      {records.map((r) => (
        <li key={r.id} className="flex items-center justify-between gap-3 py-2">
          <div className="min-w-0 text-sm">
            <span className="font-medium">{formatAttendanceDate(r.date)}</span>
            {r.note ? <span className="text-muted-foreground ml-2">{r.note}</span> : null}
          </div>
          <Badge className={statusBadgeClass(r.status)}>{statusLabel(r.status)}</Badge>
        </li>
      ))}
    </ul>
  );
}
