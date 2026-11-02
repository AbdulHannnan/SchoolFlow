import { Suspense } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";

import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PrintButton } from "@/components/academics/print-button";
import { SendWeeklyReportButton } from "@/components/academics/send-weekly-report-button";
import { requireRole } from "@/server/auth/dal";
import { getStudentWeeklyReport } from "@/server/academics/weekly-report";
import { formatDay } from "@/lib/attendance";

export const metadata: Metadata = {
  title: "Student Report - School Management",
};

// Dynamic route segment: render on demand (see the Cache Components notes).
export const instant = false;

type Params = Promise<{ studentId: string }>;

export default function StudentReportPage({ params }: { params: Params }) {
  return (
    <AppShell title="Student Report">
      <Suspense fallback={<div className="bg-muted h-64 animate-pulse rounded-xl" />}>
        <StudentReportContent params={params} />
      </Suspense>
    </AppShell>
  );
}

async function StudentReportContent({ params }: { params: Params }) {
  await requireRole("HEAD");
  const { studentId } = await params;

  let data: Awaited<ReturnType<typeof getStudentWeeklyReport>> | null = null;
  let error: string | null = null;
  try {
    data = await getStudentWeeklyReport(studentId);
  } catch (e) {
    error = e instanceof Error ? e.message : "Unable to load this report.";
  }
  if (error || !data) {
    return <p className="text-muted-foreground text-sm">{error ?? "Report not available."}</p>;
  }

  const { school, student, weekLabel, attendance, performance, openFlags } = data;
  const a = attendance;

  return (
    <div className="space-y-4">
      {/* Controls — hidden when printing. */}
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/students"
          className="text-muted-foreground hover:text-foreground -ml-2 inline-flex items-center gap-1 px-2 text-sm"
        >
          <ArrowLeft className="size-4" />
          Back to students
        </Link>
        <PrintButton />
      </div>

      {/* The report document — classic template. */}
      <Card>
        <CardHeader className="border-b text-center">
          <p className="text-lg font-semibold tracking-tight">{school.name}</p>
          <p className="text-muted-foreground text-sm">Weekly Student Report</p>
          <p className="text-muted-foreground text-xs">Week of {weekLabel}</p>
        </CardHeader>
        <CardContent className="space-y-6 pt-6">
          {/* Student identity. */}
          <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-muted-foreground text-xs">Student</dt>
              <dd className="font-medium">{student.name}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs">Class</dt>
              <dd className="font-medium">
                {student.className ?? "-"}
                {student.sectionName ? ` - ${student.sectionName}` : ""}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs">Roll number</dt>
              <dd className="font-medium">{student.rollNumber ?? "-"}</dd>
            </div>
          </dl>

          {/* Attendance. */}
          <section className="space-y-2">
            <h2 className="text-sm font-semibold">Attendance this week</h2>
            {a.total === 0 ? (
              <p className="text-muted-foreground text-sm">No attendance marked this week.</p>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                <Stat label="Present" value={a.present} />
                <Stat label="Absent" value={a.absent} />
                <Stat label="Late" value={a.late} />
                <Stat label="Leave" value={a.leave} />
                <Stat label="Days marked" value={a.total} />
              </div>
            )}
          </section>

          {/* Performance. */}
          <section className="space-y-2">
            <h2 className="text-sm font-semibold">Performance</h2>
            {performance ? (
              <p className="text-sm">
                <span className="font-medium">{performance.examName}</span>
                {": "}
                {performance.percent}% ({performance.grade})
                <span className="text-muted-foreground ml-1 text-xs">· latest published exam</span>
              </p>
            ) : (
              <p className="text-muted-foreground text-sm">No published exam results yet.</p>
            )}
          </section>

          {/* Red flags. */}
          <section className="space-y-2">
            <h2 className="text-sm font-semibold">Red flags</h2>
            {openFlags.length === 0 ? (
              <p className="text-muted-foreground text-sm">None open.</p>
            ) : (
              <ul className="space-y-1.5">
                {openFlags.map((f) => (
                  <li key={f.id} className="flex flex-wrap items-center gap-2 text-sm">
                    <Badge variant="destructive">{f.title}</Badge>
                    <span>{f.detail}</span>
                    <span className="text-muted-foreground text-xs">
                      · raised {formatDay(f.createdAt)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </CardContent>
      </Card>

      {/* Send controls — hidden when printing. */}
      <Card className="no-print">
        <CardContent className="space-y-3 pt-6">
          <div>
            <h2 className="text-sm font-medium">Send to parent via WhatsApp</h2>
            <p className="text-muted-foreground text-sm">
              Sends this report to the student&apos;s linked parent(s) on WhatsApp and in-app.
            </p>
          </div>

          {data.parentCount === 0 ? (
            <p className="text-destructive text-sm">
              No parent is linked to this student yet, so there is no WhatsApp number to send to.
              Link a parent from the Parents page first.
            </p>
          ) : null}

          {!data.whatsappConfigured ? (
            <p className="text-muted-foreground text-sm">
              Your school&apos;s WhatsApp number is not set yet, so sending stays off until it is
              added.
            </p>
          ) : null}

          <SendWeeklyReportButton studentId={student.id} label="Send via WhatsApp" />
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border px-3 py-2 text-center">
      <p className="text-xl font-semibold">{value}</p>
      <p className="text-muted-foreground text-xs">{label}</p>
    </div>
  );
}
