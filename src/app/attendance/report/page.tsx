import { Suspense } from "react";
import { Download } from "lucide-react";
import type { Metadata } from "next";

import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ReportControls } from "@/components/academics/report-controls";
import { PrintButton } from "@/components/academics/print-button";
import { AttendanceSummary } from "@/components/academics/attendance-summary";
import type { MarkableClass } from "@/components/academics/attendance-picker";
import { requireRole } from "@/server/auth/dal";
import { getClassAttendanceReport, listMarkableClasses } from "@/server/academics/attendance";
import { formatDay, normalizeDate, presentRate } from "@/lib/attendance";

export const metadata: Metadata = {
  title: "Attendance report - School Management",
};

type SearchParams = Promise<{
  classId?: string;
  sectionId?: string;
  from?: string;
  to?: string;
}>;

export default function AttendanceReportPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <AppShell title="Attendance report">
      <Suspense fallback={<div className="bg-muted h-64 animate-pulse rounded-xl" />}>
        <ReportContent searchParams={searchParams} />
      </Suspense>
    </AppShell>
  );
}

const numCell = "px-2 py-2 text-right tabular-nums";

async function ReportContent({ searchParams }: { searchParams: SearchParams }) {
  await requireRole("HEAD", "TEACHER");
  const sp = await searchParams;
  const classes = await listMarkableClasses();

  const selectedClass = classes.find((c) => c.id === sp.classId) ?? null;
  const sectionId =
    selectedClass && sp.sectionId && selectedClass.sections.some((s) => s.id === sp.sectionId)
      ? sp.sectionId
      : "";
  const from = normalizeDate(sp.from);
  const to = normalizeDate(sp.to);

  const classOptions: MarkableClass[] = classes.map((c) => ({
    id: c.id,
    name: c.name,
    sections: c.sections,
  }));

  if (classes.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        You have no classes to report on. A head can assign you to one.
      </p>
    );
  }

  const report = selectedClass
    ? await getClassAttendanceReport({
        classId: selectedClass.id,
        sectionId: sectionId || null,
        from: new Date(from),
        to: new Date(to),
      })
    : null;

  const exportParams = new URLSearchParams({ classId: selectedClass?.id ?? "", from, to });
  if (sectionId) exportParams.set("sectionId", sectionId);

  return (
    <div className="space-y-6">
      <Card className="no-print">
        <CardHeader>
          <CardTitle className="text-base">Report filters</CardTitle>
        </CardHeader>
        <CardContent>
          <ReportControls
            classes={classOptions}
            selectedClassId={selectedClass?.id ?? ""}
            selectedSectionId={sectionId}
            from={from}
            to={to}
          />
        </CardContent>
      </Card>

      {!selectedClass || !report ? (
        <p className="text-muted-foreground text-sm">
          Pick a class and date range above, then Apply (or use a quick range).
        </p>
      ) : (
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base">{report.class.name}</CardTitle>
                <p className="text-muted-foreground text-xs">
                  {formatDay(report.from)} - {formatDay(report.to)}
                </p>
              </div>
              <div className="no-print flex items-center gap-2">
                <Button asChild variant="outline" size="sm">
                  <a href={`/attendance/report/export?${exportParams.toString()}`}>
                    <Download className="size-4" /> Export CSV
                  </a>
                </Button>
                <PrintButton />
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <AttendanceSummary counts={report.totals} />

            {report.rows.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No active students in this class{sectionId ? " / section" : ""}.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-muted-foreground border-border border-b text-xs">
                      <th className="px-2 py-2 text-left font-medium">Roll</th>
                      <th className="px-2 py-2 text-left font-medium">Student</th>
                      <th className="px-2 py-2 text-right font-medium">Present</th>
                      <th className="px-2 py-2 text-right font-medium">Absent</th>
                      <th className="px-2 py-2 text-right font-medium">Late</th>
                      <th className="px-2 py-2 text-right font-medium">Leave</th>
                      <th className="px-2 py-2 text-right font-medium">Total</th>
                      <th className="px-2 py-2 text-right font-medium">% Present</th>
                    </tr>
                  </thead>
                  <tbody className="divide-border divide-y">
                    {report.rows.map((r) => {
                      const rate = presentRate(r.counts.PRESENT, r.counts.total);
                      return (
                        <tr key={r.student.id}>
                          <td className="text-muted-foreground px-2 py-2">
                            {r.student.rollNumber ?? "-"}
                          </td>
                          <td className="px-2 py-2 font-medium">
                            {r.student.name}
                            {r.student.section ? (
                              <span className="text-muted-foreground ml-2 font-normal">
                                {r.student.section.name}
                              </span>
                            ) : null}
                          </td>
                          <td className={numCell}>{r.counts.PRESENT}</td>
                          <td className={numCell}>{r.counts.ABSENT}</td>
                          <td className={numCell}>{r.counts.LATE}</td>
                          <td className={numCell}>{r.counts.LEAVE}</td>
                          <td className={numCell}>{r.counts.total}</td>
                          <td className={numCell}>{rate == null ? "-" : `${rate}%`}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-border border-t font-medium">
                      <td className="px-2 py-2" colSpan={2}>
                        Total
                      </td>
                      <td className={numCell}>{report.totals.PRESENT}</td>
                      <td className={numCell}>{report.totals.ABSENT}</td>
                      <td className={numCell}>{report.totals.LATE}</td>
                      <td className={numCell}>{report.totals.LEAVE}</td>
                      <td className={numCell}>{report.totals.total}</td>
                      <td className={numCell}>
                        {(() => {
                          const rate = presentRate(report.totals.PRESENT, report.totals.total);
                          return rate == null ? "-" : `${rate}%`;
                        })()}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
