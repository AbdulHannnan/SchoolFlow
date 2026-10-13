import { Suspense } from "react";
import Link from "next/link";
import { forbidden } from "next/navigation";
import type { Metadata } from "next";

import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StaffAttendancePicker } from "@/components/academics/staff-attendance-picker";
import { MarkStaffAttendanceForm } from "@/components/academics/mark-staff-attendance-form";
import { verifySession } from "@/server/auth/dal";
import { getStaffAttendanceForDate } from "@/server/academics/staff-attendance";
import { normalizeDate } from "@/lib/attendance";

export const metadata: Metadata = {
  title: "Staff attendance - School Management",
};

type SearchParams = Promise<{ date?: string }>;

export default function StaffAttendancePage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <AppShell title="Staff attendance">
      <Suspense fallback={<div className="bg-muted h-64 animate-pulse rounded-xl" />}>
        <StaffAttendanceContent searchParams={searchParams} />
      </Suspense>
    </AppShell>
  );
}

async function StaffAttendanceContent({ searchParams }: { searchParams: SearchParams }) {
  const user = await verifySession();
  // Marking and reviewing staff attendance is the HEAD's job.
  if (user.role !== "HEAD") {
    forbidden();
  }

  const date = normalizeDate((await searchParams).date);
  const { roster } = await getStaffAttendanceForDate({ date: new Date(date) });

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button asChild variant="outline" size="sm">
          <Link href="/staff-attendance/summary">Monthly summary</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Choose a date</CardTitle>
        </CardHeader>
        <CardContent>
          <StaffAttendancePicker date={date} />
        </CardContent>
      </Card>

      {roster.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No teaching staff yet. Add teachers to start marking their attendance.
        </p>
      ) : (
        <MarkStaffAttendanceForm date={date} roster={roster} />
      )}
    </div>
  );
}
