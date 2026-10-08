import { Suspense } from "react";
import type { Metadata } from "next";

import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AttendancePicker, type MarkableClass } from "@/components/academics/attendance-picker";
import { MarkAttendanceForm } from "@/components/academics/mark-attendance-form";
import { requireRole } from "@/server/auth/dal";
import { getClassAttendanceForDate, listMarkableClasses } from "@/server/academics/attendance";

export const metadata: Metadata = {
  title: "Attendance - School Management",
};

type SearchParams = Promise<{ classId?: string; sectionId?: string; date?: string }>;

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
  await requireRole("TEACHER", "HEAD");
  const sp = await searchParams;
  const classes = await listMarkableClasses();

  const date = sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : todayISO();
  const selectedClass = classes.find((c) => c.id === sp.classId) ?? null;
  // A section filter only counts if it belongs to the selected class.
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
