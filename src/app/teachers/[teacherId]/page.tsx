import { Suspense } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";

import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { addBoxClass } from "@/components/ui/add-box";
import { AddTimetableForm } from "@/components/academics/add-timetable-form";
import { TimetableDayView } from "@/components/academics/timetable-day-view";
import { requireRole } from "@/server/auth/dal";
import { getTeacherTimetable } from "@/server/academics/teachers";
import { listSubjects } from "@/server/academics/subjects";
import { listClassesWithSections } from "@/server/academics/classes";

export const metadata: Metadata = {
  title: "Teacher timetable - School Management",
};

type Params = Promise<{ teacherId: string }>;

export default function TeacherTimetablePage({ params }: { params: Params }) {
  return (
    <AppShell title="Teacher timetable">
      <Suspense fallback={<div className="bg-muted h-64 animate-pulse rounded-xl" />}>
        <TimetableContent params={params} />
      </Suspense>
    </AppShell>
  );
}

async function TimetableContent({ params }: { params: Params }) {
  await requireRole("HEAD");
  const { teacherId } = await params;

  const [{ teacher, entries }, subjects, classes] = await Promise.all([
    getTeacherTimetable(teacherId),
    listSubjects(),
    listClassesWithSections(),
  ]);

  const subjectOptions = subjects.map((s) => ({ id: s.id, name: s.name }));
  const classOptions = classes.map((c) => ({ id: c.id, name: c.name }));

  return (
    <div className="space-y-4">
      <Link
        href="/teachers"
        className="text-muted-foreground hover:text-foreground -ml-1 inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" />
        All teachers
      </Link>

      <div>
        <h2 className="text-lg font-semibold">{teacher.name}</h2>
        <p className="text-muted-foreground text-sm">{teacher.email}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Timetable</CardTitle>
        </CardHeader>
        <CardContent>
          <TimetableDayView entries={entries} />
        </CardContent>
      </Card>

      <Card className={addBoxClass}>
        <CardHeader>
          <CardTitle className="text-base">Add a period</CardTitle>
        </CardHeader>
        <CardContent>
          {subjectOptions.length === 0 || classOptions.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Add at least one subject and one class first.
            </p>
          ) : (
            <AddTimetableForm
              teacherId={teacher.id}
              subjects={subjectOptions}
              classes={classOptions}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
