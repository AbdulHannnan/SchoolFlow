import { Suspense } from "react";
import type { Metadata } from "next";

import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PrintButton } from "@/components/academics/print-button";
import { verifySession } from "@/server/auth/dal";
import { getReportCard, type ReportCardRow } from "@/server/academics/exams";
import { formatDay } from "@/lib/attendance";
import { EXAM_TYPE_LABELS, formatMarks, formatPercent } from "@/lib/grades";

export const metadata: Metadata = {
  title: "Report Card - School Management",
};

// Dynamic route segments: render on demand (see the Cache Components notes).
export const instant = false;

type Params = Promise<{ examId: string; studentId: string }>;

export default function ReportCardPage({ params }: { params: Params }) {
  return (
    <AppShell title="Report Card">
      <Suspense fallback={<div className="bg-muted h-64 animate-pulse rounded-xl" />}>
        <ReportCardContent params={params} />
      </Suspense>
    </AppShell>
  );
}

async function ReportCardContent({ params }: { params: Params }) {
  // getReportCard authorizes: HEAD any, TEACHER assigned class, PARENT a linked
  // child (and only once the exam is published).
  await verifySession();
  const { examId, studentId } = await params;

  let data: Awaited<ReturnType<typeof getReportCard>> | null = null;
  let error: string | null = null;
  try {
    data = await getReportCard(examId, studentId);
  } catch (e) {
    error = e instanceof Error ? e.message : "Unable to load this report card.";
  }
  if (error || !data) {
    return <p className="text-muted-foreground text-sm">{error ?? "Report card not available."}</p>;
  }

  const { exam, student, rows, totals } = data;

  return (
    <div className="space-y-6">
      <div className="no-print flex justify-end">
        <PrintButton />
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <CardTitle className="text-base">{student.name}</CardTitle>
              <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
                {student.rollNumber ? <span>Roll {student.rollNumber}</span> : null}
                <span>
                  {student.class.name}
                  {student.section ? ` - ${student.section.name}` : ""}
                </span>
              </div>
            </div>
            <div className="space-y-1 text-right">
              <p className="text-sm font-medium">{exam.name}</p>
              <div className="text-muted-foreground flex flex-wrap items-center justify-end gap-2 text-xs">
                <Badge variant="secondary">{EXAM_TYPE_LABELS[exam.type]}</Badge>
                {exam.term ? <span>{exam.term}</span> : null}
                {exam.startDate ? <span>{formatDay(exam.startDate)}</span> : null}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="text-muted-foreground text-sm">This exam has no subjects.</p>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-muted-foreground text-xs">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Subject</th>
                    <th className="px-3 py-2 text-right font-medium">Marks</th>
                    <th className="px-3 py-2 text-right font-medium">Max</th>
                    <th className="px-3 py-2 text-right font-medium">%</th>
                    <th className="px-3 py-2 text-center font-medium">Grade</th>
                    <th className="px-3 py-2 text-center font-medium">Result</th>
                  </tr>
                </thead>
                <tbody className="divide-border divide-y">
                  {rows.map((r) => (
                    <SubjectRow key={r.examSubjectId} row={r} />
                  ))}
                </tbody>
                <tfoot className="border-t font-medium">
                  <tr>
                    <td className="px-3 py-2">Total</td>
                    <td className="px-3 py-2 text-right">{formatMarks(totals.obtained)}</td>
                    <td className="px-3 py-2 text-right">{formatMarks(totals.max)}</td>
                    <td className="px-3 py-2 text-right">{formatPercent(totals.percentage)}</td>
                    <td className="px-3 py-2 text-center">{totals.grade ?? "—"}</td>
                    <td className="px-3 py-2" />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SubjectRow({ row }: { row: ReportCardRow }) {
  return (
    <tr>
      <td className="px-3 py-2">{row.subjectName}</td>
      <td className="px-3 py-2 text-right">{formatMarks(row.marksObtained, row.isAbsent)}</td>
      <td className="text-muted-foreground px-3 py-2 text-right">{row.maxMarks}</td>
      <td className="px-3 py-2 text-right">{formatPercent(row.percentage)}</td>
      <td className="px-3 py-2 text-center">{row.grade ?? "—"}</td>
      <td className="px-3 py-2 text-center">
        {row.passed === null ? (
          <span className="text-muted-foreground">{"—"}</span>
        ) : row.passed ? (
          <Badge variant="secondary">Pass</Badge>
        ) : (
          <Badge variant="destructive">Fail</Badge>
        )}
      </td>
    </tr>
  );
}
