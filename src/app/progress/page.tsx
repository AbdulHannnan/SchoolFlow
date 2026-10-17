import { Suspense } from "react";
import Link from "next/link";
import { forbidden } from "next/navigation";
import type { Metadata } from "next";

import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProgressClassPicker } from "@/components/academics/progress-class-picker";
import { MonthNav } from "@/components/academics/month-nav";
import { AllClassesProgress } from "@/components/academics/all-classes-progress";
import { ClassNoteForm } from "@/components/academics/class-note-form";
import { DeleteButton } from "@/components/academics/delete-button";
import { verifySession } from "@/server/auth/dal";
import { listMarkableClasses } from "@/server/academics/attendance";
import { listChildrenProgress, listClassProgress } from "@/server/academics/progress";
import { getAllClassesProgress, listClassNotes } from "@/server/academics/class-progress";
import { deleteClassNoteAction } from "@/app/progress/actions";
import { monthLabel, formatDay, todayISODate } from "@/lib/attendance";
import { CLASS_NOTE_TYPE_BADGE, CLASS_NOTE_TYPE_LABELS } from "@/lib/class-notes";

export const metadata: Metadata = {
  title: "Progress - School Management",
};

type SearchParams = Promise<{ classId?: string; month?: string }>;

export default function ProgressPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <AppShell title="Progress">
      <Suspense fallback={<div className="bg-muted h-64 animate-pulse rounded-xl" />}>
        <ProgressContent searchParams={searchParams} />
      </Suspense>
    </AppShell>
  );
}

function rateClass(rate: number | null): string {
  if (rate === null) return "text-muted-foreground";
  if (rate < 75) return "text-destructive";
  return "";
}

async function ProgressContent({ searchParams }: { searchParams: SearchParams }) {
  const user = await verifySession();

  if (user.role === "PARENT") return <ChildrenProgress />;
  if (user.role === "HEAD") return <HeadClassProgress searchParams={searchParams} />;
  if (user.role === "TEACHER") return <TeacherClassRoster searchParams={searchParams} />;
  forbidden();
}

/** HEAD: the all-classes visual overview plus the class-note log. */
async function HeadClassProgress({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const data = await getAllClassesProgress({ month: sp.month });
  const classes = await listMarkableClasses();
  const notes = await listClassNotes({ take: 25 });

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-medium">All classes</h2>
            <p className="text-muted-foreground text-sm">
              Attendance and notes for {monthLabel(data.month)}; exam averages are all-time
              (published).
            </p>
          </div>
          <MonthNav month={data.month} />
        </div>
        <AllClassesProgress data={data} />
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-sm font-medium">Log a class note</h2>
          <p className="text-muted-foreground text-sm">
            Record a head visit, a general observation, an assembly activity, or a parent comment.
          </p>
        </div>
        <Card>
          <CardContent className="pt-6">
            <ClassNoteForm
              classes={classes.map((c) => ({ id: c.id, name: c.name }))}
              today={todayISODate()}
            />
          </CardContent>
        </Card>

        <div className="space-y-2">
          <h3 className="text-sm font-medium">Recent notes</h3>
          {notes.length === 0 ? (
            <p className="text-muted-foreground text-sm">No notes logged yet.</p>
          ) : (
            <ul className="divide-border divide-y rounded-md border">
              {notes.map((n) => (
                <li key={n.id} className="flex items-start justify-between gap-3 px-3 py-3">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs ${CLASS_NOTE_TYPE_BADGE[n.type]}`}
                      >
                        {CLASS_NOTE_TYPE_LABELS[n.type]}
                      </span>
                      <span className="text-sm font-medium">{n.className}</span>
                      <span className="text-muted-foreground text-xs">{formatDay(n.date)}</span>
                    </div>
                    <p className="text-sm font-medium">{n.title}</p>
                    <p className="text-muted-foreground text-sm">{n.body}</p>
                    {n.authorName ? (
                      <p className="text-muted-foreground text-xs">by {n.authorName}</p>
                    ) : null}
                  </div>
                  <DeleteButton action={deleteClassNoteAction} id={n.id} label="note" />
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}

/** TEACHER: pick one assigned class and see each student's monthly snapshot. */
async function TeacherClassRoster({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const classes = await listMarkableClasses();

  if (classes.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        You have no classes yet. A head can add classes and assign you to one.
      </p>
    );
  }

  const selectedClass = classes.find((c) => c.id === sp.classId) ?? null;
  const data = selectedClass ? await listClassProgress(selectedClass.id) : null;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Choose a class</CardTitle>
        </CardHeader>
        <CardContent>
          <ProgressClassPicker
            classes={classes.map((c) => ({ id: c.id, name: c.name }))}
            selectedClassId={selectedClass?.id ?? ""}
          />
        </CardContent>
      </Card>

      {!selectedClass || !data ? (
        <p className="text-muted-foreground text-sm">
          Pick a class above to see each student&apos;s progress.
        </p>
      ) : (
        <section className="space-y-3">
          <h2 className="text-sm font-medium">
            {selectedClass.name}
            <span className="text-muted-foreground ml-2 font-normal">
              attendance for {monthLabel(data.month)}
            </span>
          </h2>
          {data.rows.length === 0 ? (
            <p className="text-muted-foreground text-sm">No active students in this class.</p>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-muted-foreground text-xs">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Roll</th>
                    <th className="px-3 py-2 text-left font-medium">Student</th>
                    <th className="px-3 py-2 text-right font-medium">Present</th>
                    <th className="px-3 py-2 text-center font-medium">Flags</th>
                    <th className="px-3 py-2 text-right font-medium"></th>
                  </tr>
                </thead>
                <tbody className="divide-border divide-y">
                  {data.rows.map((row) => (
                    <tr key={row.student.id}>
                      <td className="text-muted-foreground px-3 py-2">
                        {row.student.rollNumber ?? "—"}
                      </td>
                      <td className="px-3 py-2">
                        {row.student.name}
                        {row.student.section ? (
                          <span className="text-muted-foreground ml-2 text-xs">
                            {row.student.section.name}
                          </span>
                        ) : null}
                      </td>
                      <td className={`px-3 py-2 text-right ${rateClass(row.presentRate)}`}>
                        {row.presentRate === null ? "—" : `${row.presentRate}%`}
                        {row.markedDays > 0 ? (
                          <span className="text-muted-foreground ml-1 text-xs">
                            ({row.markedDays}d)
                          </span>
                        ) : null}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {row.openFlags > 0 ? (
                          <Badge variant="destructive">{row.openFlags}</Badge>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Link
                          href={`/progress/${row.student.id}`}
                          className="underline-offset-4 hover:underline"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

async function ChildrenProgress() {
  const { children, month } = await listChildrenProgress();

  if (children.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        No children are linked to your account yet. Please contact the school.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-medium">
        Your children
        <span className="text-muted-foreground ml-2 font-normal">
          attendance for {monthLabel(month)}
        </span>
      </h2>
      <ul className="space-y-2">
        {children.map((row) => (
          <li key={row.student.id}>
            <Card>
              <CardContent className="flex flex-wrap items-center justify-between gap-2 py-3">
                <div>
                  <p className="text-sm font-medium">{row.student.name}</p>
                  <p className="text-muted-foreground text-xs">
                    {row.student.class?.name ?? ""}
                    {row.student.section ? ` - ${row.student.section.name}` : ""} ·{" "}
                    {row.presentRate === null
                      ? "no attendance yet"
                      : `${row.presentRate}% present (${row.markedDays}d)`}
                  </p>
                </div>
                <Link
                  href={`/progress/${row.student.id}`}
                  className="text-sm underline-offset-4 hover:underline"
                >
                  View progress
                </Link>
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
