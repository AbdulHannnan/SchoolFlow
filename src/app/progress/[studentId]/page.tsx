import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import type { RedFlagType } from "@prisma/client";

import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { verifySession } from "@/server/auth/dal";
import { getStudentProgress } from "@/server/academics/progress";
import { formatDay, monthLabel } from "@/lib/attendance";
import { formatPercent } from "@/lib/grades";

export const metadata: Metadata = {
  title: "Student Progress - School Management",
};

// Dynamic route: the shell's `usePathname()` has no statically-known path for a
// `[studentId]` segment, so render on demand. See the Cache Components notes.
export const instant = false;

const FLAG_LABELS: Record<RedFlagType, string> = {
  ATTENDANCE_LOW: "Attendance",
  GRADES_LOW: "Grades",
};

type Params = Promise<{ studentId: string }>;

export default function StudentProgressPage({ params }: { params: Params }) {
  return (
    <AppShell title="Student Progress">
      <Suspense fallback={<div className="bg-muted h-64 animate-pulse rounded-xl" />}>
        <StudentProgressContent params={params} />
      </Suspense>
    </AppShell>
  );
}

async function StudentProgressContent({ params }: { params: Params }) {
  // getStudentProgress authorizes: HEAD any, TEACHER assigned class, PARENT a
  // linked child (and published exams / no red flags for parents).
  await verifySession();
  const { studentId } = await params;

  let data: Awaited<ReturnType<typeof getStudentProgress>> | null = null;
  let error: string | null = null;
  try {
    data = await getStudentProgress(studentId);
  } catch (e) {
    error = e instanceof Error ? e.message : "Unable to load this student's progress.";
  }
  if (error || !data) {
    return <p className="text-muted-foreground text-sm">{error ?? "Progress not available."}</p>;
  }

  const { student, month, attendance, exams, openFlags, canSeeFlags } = data;
  const m = attendance.month;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {student.name}
            <span className="text-muted-foreground ml-2 text-sm font-normal">
              {student.class?.name ?? ""}
              {student.section ? ` - ${student.section.name}` : ""}
              {student.rollNumber ? ` · Roll ${student.rollNumber}` : ""}
            </span>
          </CardTitle>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-base">Attendance</CardTitle>
            <Button asChild size="sm" variant="secondary">
              <Link href={`/attendance/${student.id}`}>Full attendance</Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-muted-foreground text-xs">Overall present rate</p>
            <p className="text-2xl font-semibold">
              {attendance.presentRate === null ? "—" : `${attendance.presentRate}%`}
              <span className="text-muted-foreground ml-2 text-sm font-normal">
                {attendance.overall.total} day{attendance.overall.total === 1 ? "" : "s"} recorded
              </span>
            </p>
          </div>
          <div>
            <p className="text-muted-foreground mb-1 text-xs">{monthLabel(month)}</p>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
              <span>Present {m.PRESENT}</span>
              <span>Absent {m.ABSENT}</span>
              <span>Late {m.LATE}</span>
              <span>Leave {m.LEAVE}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Exam results</CardTitle>
        </CardHeader>
        <CardContent>
          {exams.length === 0 ? (
            <p className="text-muted-foreground text-sm">No exam results yet.</p>
          ) : (
            <ul className="divide-border divide-y">
              {exams.map((e) => (
                <li
                  key={e.examId}
                  className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm"
                >
                  <div>
                    <span className="font-medium">{e.name}</span>
                    <span className="text-muted-foreground ml-2 text-xs">
                      {e.term ? `${e.term} · ` : ""}
                      {e.startDate ? formatDay(e.startDate) : ""}
                      {!e.isPublished ? " · draft" : ""}
                    </span>
                  </div>
                  <span className="flex items-center gap-3">
                    <span>
                      {formatPercent(e.percentage)}
                      {e.grade ? (
                        <span className="text-muted-foreground ml-1">({e.grade})</span>
                      ) : null}
                    </span>
                    <Link
                      href={`/exams/${e.examId}/students/${student.id}`}
                      className="underline-offset-4 hover:underline"
                    >
                      Report card
                    </Link>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {canSeeFlags ? (
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-base">Open red flags</CardTitle>
              <Button asChild size="sm" variant="outline">
                <Link href="/red-flags">Manage</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {openFlags.length === 0 ? (
              <p className="text-muted-foreground text-sm">No open red flags.</p>
            ) : (
              <ul className="space-y-2">
                {openFlags.map((f) => (
                  <li key={f.id} className="flex flex-wrap items-center gap-2 text-sm">
                    <Badge variant="destructive">{FLAG_LABELS[f.type]}</Badge>
                    <span>{f.detail}</span>
                    <span className="text-muted-foreground text-xs">
                      · raised {formatDay(f.createdAt)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
