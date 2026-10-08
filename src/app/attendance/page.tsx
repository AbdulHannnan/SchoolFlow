import { Suspense } from "react";
import Link from "next/link";
import { forbidden } from "next/navigation";
import type { Metadata } from "next";

import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AttendancePicker, type MarkableClass } from "@/components/academics/attendance-picker";
import { MarkAttendanceForm } from "@/components/academics/mark-attendance-form";
import { AttendanceSummary } from "@/components/academics/attendance-summary";
import { AttendanceRecords } from "@/components/academics/attendance-records";
import { MonthNav } from "@/components/academics/month-nav";
import { verifySession } from "@/server/auth/dal";
import {
  getClassAttendanceForDate,
  listChildrenAttendance,
  listMarkableClasses,
} from "@/server/academics/attendance";
import { monthLabel, normalizeMonth } from "@/lib/attendance";

export const metadata: Metadata = {
  title: "Attendance - School Management",
};

type SearchParams = Promise<{
  classId?: string;
  sectionId?: string;
  date?: string;
  month?: string;
}>;

export default function AttendancePage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <AppShell title="Attendance">
      <Suspense fallback={<div className="bg-muted h-64 animate-pulse rounded-xl" />}>
        <AttendanceContent searchParams={searchParams} />
      </Suspense>
    </AppShell>
  );
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

async function AttendanceContent({ searchParams }: { searchParams: SearchParams }) {
  const user = await verifySession();
  const sp = await searchParams;

  // Parents get a read-only view of their own children.
  if (user.role === "PARENT") {
    return <ParentAttendance month={normalizeMonth(sp.month)} />;
  }
  if (user.role !== "TEACHER" && user.role !== "HEAD") {
    forbidden();
  }

  // Teacher / Head: the marking flow.
  const classes = await listMarkableClasses();

  const date = sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : todayISO();
  const selectedClass = classes.find((c) => c.id === sp.classId) ?? null;
  const sectionId =
    selectedClass && sp.sectionId && selectedClass.sections.some((s) => s.id === sp.sectionId)
      ? sp.sectionId
      : null;

  const classOptions: MarkableClass[] = classes.map((c) => ({
    id: c.id,
    name: c.name,
    sections: c.sections,
  }));

  if (classes.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        You have no classes to take attendance for. A head can assign you to one.
      </p>
    );
  }

  const roster = selectedClass
    ? await getClassAttendanceForDate({
        classId: selectedClass.id,
        sectionId,
        date: new Date(date),
      })
    : null;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Choose a class and date</CardTitle>
        </CardHeader>
        <CardContent>
          <AttendancePicker
            classes={classOptions}
            selectedClassId={selectedClass?.id ?? ""}
            selectedSectionId={sectionId ?? ""}
            date={date}
          />
        </CardContent>
      </Card>

      {!selectedClass ? (
        <p className="text-muted-foreground text-sm">
          Pick a class above to load its roster for the chosen date.
        </p>
      ) : roster && roster.roster.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No active students in {roster.class.name}
          {sectionId ? " for that section" : ""}.
        </p>
      ) : roster ? (
        <MarkAttendanceForm
          classId={selectedClass.id}
          sectionId={sectionId ?? ""}
          date={date}
          className={roster.class.name}
          roster={roster.roster}
        />
      ) : null}
    </div>
  );
}

async function ParentAttendance({ month }: { month: string }) {
  const { children } = await listChildrenAttendance({ month });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-medium">
          Attendance
          <span className="text-muted-foreground ml-2 font-normal">{monthLabel(month)}</span>
        </h2>
        <MonthNav month={month} />
      </div>

      {children.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No children are linked to your account yet. Please contact the school.
        </p>
      ) : (
        children.map(({ student, relation, counts, records }) => (
          <Card key={student.id}>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="text-base">
                  <Link
                    href={`/attendance/${student.id}?month=${month}`}
                    className="hover:underline"
                  >
                    {student.name}
                  </Link>
                  <span className="text-muted-foreground ml-2 text-sm font-normal">
                    {student.class.name}
                    {student.section ? ` - ${student.section.name}` : ""}
                  </span>
                </CardTitle>
                {relation ? (
                  <Badge variant="secondary" className="capitalize">
                    {relation.toLowerCase()}
                  </Badge>
                ) : null}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <AttendanceSummary counts={counts} />
              <AttendanceRecords records={records} />
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
