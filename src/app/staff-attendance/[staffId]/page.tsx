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
import { getStaffMemberAttendance } from "@/server/academics/staff-attendance";
import { monthLabel, normalizeMonth } from "@/lib/attendance";

export const metadata: Metadata = {
  title: "Staff attendance - School Management",
};

// Dynamic route: the shell's `usePathname()` has no statically-known path for a
// `[staffId]` segment, so this renders on demand rather than prerendering a
// static shell. See the Cache Components notes.
export const instant = false;

type Params = Promise<{ staffId: string }>;
type SearchParams = Promise<{ month?: string }>;

export default function StaffMemberAttendancePage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  return (
    <AppShell title="Staff attendance">
      <Suspense fallback={<div className="bg-muted h-64 animate-pulse rounded-xl" />}>
        <StaffMemberAttendanceContent params={params} searchParams={searchParams} />
      </Suspense>
    </AppShell>
  );
}

async function StaffMemberAttendanceContent({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const user = await verifySession();
  if (user.role !== "HEAD") {
    forbidden();
  }

  const { staffId } = await params;
  const month = normalizeMonth((await searchParams).month);

  let data: Awaited<ReturnType<typeof getStaffMemberAttendance>> | null = null;
  let error: string | null = null;
  try {
    data = await getStaffMemberAttendance({ staffId, month });
  } catch (e) {
    error = e instanceof Error ? e.message : "Unable to load attendance.";
  }

  return (
    <div className="space-y-6">
      <Link
        href={`/staff-attendance/summary?month=${month}`}
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" /> Back
      </Link>

      {error || !data ? (
        <p className="text-muted-foreground text-sm">
          {error ?? "This staff member's attendance isn't available."}
        </p>
      ) : (
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle className="text-base">
                {data.staff.name}
                {data.staff.mainSubject ? (
                  <span className="text-muted-foreground ml-2 text-sm font-normal">
                    {data.staff.mainSubject.name}
                  </span>
                ) : null}
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
