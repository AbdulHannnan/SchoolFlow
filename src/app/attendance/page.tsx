import { Suspense } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { forbidden } from "next/navigation";
import type { Metadata } from "next";

import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AttendancePicker, type MarkableClass } from "@/components/academics/attendance-picker";
import { MarkAttendanceForm } from "@/components/academics/mark-attendance-form";
import { AttendanceSummary } from "@/components/academics/attendance-summary";
import { AttendanceRecords } from "@/components/academics/attendance-records";
import { MonthNav } from "@/components/academics/month-nav";
import { verifySession } from "@/server/auth/dal";
import {
  getClassAttendanceForDate,
  getClassAttendanceOverview,
  listChildrenAttendance,
  listMarkableClasses,
} from "@/server/academics/attendance";
import { listClassesWithSections } from "@/server/academics/classes";
import { monthLabel, normalizeMonth, statusLabel, statusBadgeClass } from "@/lib/attendance";

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
  // Head reads only - a class drill-down, never the marking grid.
  if (user.role === "HEAD") {
    return sp.classId ? <HeadClassAttendance classId={sp.classId} /> : <HeadAttendanceOverview />;
  }
  if (user.role !== "TEACHER") {
    forbidden();
  }

  // Teacher: the marking flow.
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
      <div className="flex justify-end">
        <Button asChild variant="outline" size="sm">
          <Link href="/attendance/report">View report</Link>
        </Button>
      </div>
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

async function HeadAttendanceOverview() {
  const classes = await listClassesWithSections();

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">
        Attendance is marked by each class&apos;s teacher. Pick a class to review it.
      </p>
      {classes.length === 0 ? (
        <p className="text-muted-foreground text-sm">No classes yet.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {classes.map((cls) => (
            <Link
              key={cls.id}
              href={`/attendance?classId=${encodeURIComponent(cls.id)}`}
              className="focus-visible:ring-ring rounded-xl focus-visible:ring-2 focus-visible:outline-none"
            >
              <Card className="hover:border-primary/50 hover:bg-accent/40 h-full transition-colors">
                <CardHeader>
                  <CardTitle className="text-base">{cls.name}</CardTitle>
                  <CardDescription>
                    {cls._count.students} {cls._count.students === 1 ? "student" : "students"}
                  </CardDescription>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

async function HeadClassAttendance({ classId }: { classId: string }) {
  const { class: cls, rows } = await getClassAttendanceOverview(classId);

  return (
    <div className="space-y-4">
      <Link
        href="/attendance"
        className="text-muted-foreground hover:text-foreground -ml-1 inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" />
        All classes
      </Link>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {cls.name}
            <span className="text-muted-foreground ml-2 text-sm font-normal">
              attendance this month
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="text-muted-foreground text-sm">No active students in this class.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-muted-foreground border-b text-left">
                    <th className="py-2 pr-3 font-medium">Student</th>
                    <th className="py-2 pr-3 font-medium">Today</th>
                    <th className="w-1/2 py-2 font-medium">This month</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const pct =
                      r.monthTotal > 0 ? Math.round((r.monthPresent / r.monthTotal) * 100) : 0;
                    return (
                      <tr key={r.studentId} className="border-b last:border-0">
                        <td className="py-2 pr-3">
                          <span className="font-medium">{r.name}</span>
                          {r.rollNumber ? (
                            <span className="text-muted-foreground ml-2">#{r.rollNumber}</span>
                          ) : null}
                        </td>
                        <td className="py-2 pr-3">
                          {r.todayStatus ? (
                            <Badge variant="outline" className={statusBadgeClass(r.todayStatus)}>
                              {statusLabel(r.todayStatus)}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-xs italic">not marked</span>
                          )}
                        </td>
                        <td className="py-2">
                          <div className="flex items-center gap-2">
                            <div
                              className="bg-muted h-2 flex-1 overflow-hidden rounded-full"
                              role="progressbar"
                              aria-valuenow={pct}
                              aria-valuemin={0}
                              aria-valuemax={100}
                            >
                              <div
                                className={cn(
                                  "h-full rounded-full",
                                  pct >= 75
                                    ? "bg-green-500"
                                    : pct >= 40
                                      ? "bg-amber-500"
                                      : "bg-red-500",
                                )}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="text-muted-foreground w-24 shrink-0 text-right text-xs">
                              {r.monthTotal > 0
                                ? `${pct}% (${r.monthPresent}/${r.monthTotal})`
                                : "—"}
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
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
