import { Suspense } from "react";
import Link from "next/link";
import { forbidden } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";

import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AttendanceSummary } from "@/components/academics/attendance-summary";
import { AttendanceRecords } from "@/components/academics/attendance-records";
import { MonthNav } from "@/components/academics/month-nav";
import { verifySession } from "@/server/auth/dal";
import { getStudentAttendance } from "@/server/academics/attendance";
import { monthLabel, normalizeMonth } from "@/lib/attendance";

export const metadata: Metadata = {
  title: "Student attendance - School Management",
};

// Dynamic route: the shell's `usePathname()` has no statically-known path for a
// `[studentId]` segment, so this route renders on demand rather than
// prerendering a static shell. See the Cache Components notes.
export const instant = false;

type Params = Promise<{ studentId: string }>;
type SearchParams = Promise<{ month?: string }>;

export default function StudentAttendancePage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  return (
    <AppShell title="Attendance">
      <Suspense fallback={<div className="bg-muted h-64 animate-pulse rounded-xl" />}>
        <StudentAttendanceContent params={params} searchParams={searchParams} />
      </Suspense>
    </AppShell>
  );
}

async function StudentAttendanceContent({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const user = await verifySession();
  if (user.role !== "HEAD" && user.role !== "PARENT" && user.role !== "TEACHER") {
    forbidden();
  }

  const { studentId } = await params;
  const month = normalizeMonth((await searchParams).month);

  const backHref = user.role === "HEAD" ? "/students" : "/attendance";

  let data: Awaited<ReturnType<typeof getStudentAttendance>> | null = null;
  let error: string | null = null;
  try {
    data = await getStudentAttendance({ studentId, month });
  } catch (e) {
    error = e instanceof Error ? e.message : "Unable to load attendance.";
  }

  return (
    <div className="space-y-6">
      <Link
        href={backHref}
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" /> Back
      </Link>

      {error || !data ? (
        <p className="text-muted-foreground text-sm">
          {error ?? "This student's attendance isn't available."}
        </p>
      ) : (
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle className="text-base">
                {data.student.name}
                {data.student.rollNumber ? (
                  <span className="text-muted-foreground ml-2 font-normal">
                    #{data.student.rollNumber}
                  </span>
                ) : null}
                <span className="text-muted-foreground ml-2 text-sm font-normal">
                  {data.student.class.name}
                  {data.student.section ? ` - ${data.student.section.name}` : ""}
                </span>
              </CardTitle>
              <MonthNav month={month} />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-muted-foreground text-xs">{monthLabel(month)}</div>
            <AttendanceSummary counts={data.counts} />
            <AttendanceRecords records={data.records} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
