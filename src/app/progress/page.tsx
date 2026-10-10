import { Suspense } from "react";
import Link from "next/link";
import { forbidden } from "next/navigation";
import type { Metadata } from "next";

import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProgressClassPicker } from "@/components/academics/progress-class-picker";
import { verifySession } from "@/server/auth/dal";
import { listMarkableClasses } from "@/server/academics/attendance";
import { listChildrenProgress, listClassProgress } from "@/server/academics/progress";
import { monthLabel } from "@/lib/attendance";

export const metadata: Metadata = {
  title: "Progress - School Management",
};

type SearchParams = Promise<{ classId?: string }>;

export default function ProgressPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <AppShell title="Student Progress">
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
  if (user.role !== "TEACHER" && user.role !== "HEAD") forbidden();

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
