import { Suspense } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";

import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { addBoxClass } from "@/components/ui/add-box";
import { AddTimetableForm } from "@/components/academics/add-timetable-form";
import { DeleteButton } from "@/components/academics/delete-button";
import { deleteTimetableEntryAction } from "@/app/teachers/actions";
import { requireRole } from "@/server/auth/dal";
import { getTeacherTimetable } from "@/server/academics/teachers";
import { listSubjects } from "@/server/academics/subjects";
import { listClassesWithSections } from "@/server/academics/classes";
import { WEEKDAY_LABELS } from "@/lib/timetable";

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
          <CardTitle className="text-base">
            Timetable
            <span className="text-muted-foreground ml-2 text-sm font-normal">
              {entries.length} {entries.length === 1 ? "period" : "periods"}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {entries.length === 0 ? (
            <p className="text-muted-foreground text-sm">No periods scheduled yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-muted-foreground border-b text-left">
                    <th className="w-10 py-2 pr-3 font-medium">#</th>
                    <th className="py-2 pr-3 font-medium">Day</th>
                    <th className="py-2 pr-3 font-medium">Period</th>
                    <th className="py-2 pr-3 font-medium">Subject</th>
                    <th className="py-2 pr-3 font-medium">Class</th>
                    <th className="w-10 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {entries.map((e, i) => (
                    <tr key={e.id} className="border-b last:border-0">
                      <td className="text-muted-foreground py-2 pr-3">{i + 1}</td>
                      <td className="py-2 pr-3">{WEEKDAY_LABELS[e.day]}</td>
                      <td className="py-2 pr-3">{e.period}</td>
                      <td className="py-2 pr-3 font-medium">{e.subject.name}</td>
                      <td className="py-2 pr-3">{e.class.name}</td>
                      <td className="py-2">
                        <DeleteButton
                          action={deleteTimetableEntryAction}
                          id={e.id}
                          label={`${WEEKDAY_LABELS[e.day]} period ${e.period}`}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
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
