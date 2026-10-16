import { Suspense } from "react";
import Link from "next/link";
import { forbidden } from "next/navigation";
import type { Metadata } from "next";

import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DeleteButton } from "@/components/academics/delete-button";
import { deleteExamAction } from "@/app/exams/actions";
import { verifySession } from "@/server/auth/dal";
import { listMarkableClasses } from "@/server/academics/attendance";
import { listExams } from "@/server/academics/exams";
import { formatDay } from "@/lib/attendance";
import { EXAM_TYPE_LABELS } from "@/lib/grades";

export const metadata: Metadata = {
  title: "Exam marks - School Management",
};

type SearchParams = Promise<{ classId?: string; year?: string }>;

export default function ExamMarksPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <AppShell title="Exam marks">
      <Suspense fallback={<div className="bg-muted h-64 animate-pulse rounded-xl" />}>
        <MarksContent searchParams={searchParams} />
      </Suspense>
    </AppShell>
  );
}

async function MarksContent({ searchParams }: { searchParams: SearchParams }) {
  const user = await verifySession();
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
  const year = sp.year && /^\d{4}$/.test(sp.year) ? Number(sp.year) : null;
  const data = selectedClass ? await listExams(selectedClass.id, year) : null;
  const isHead = user.role === "HEAD";

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button asChild variant="outline" size="sm">
          <Link href="/exams">Back to exams</Link>
        </Button>
      </div>

      {/* Plain GET form: class + year filters live in the URL, no client JS. */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filter</CardTitle>
        </CardHeader>
        <CardContent>
          <form method="get" className="grid items-end gap-4 sm:grid-cols-3">
            <div className="space-y-1">
              <label htmlFor="marks-class" className="text-muted-foreground text-xs">
                Class
              </label>
              <select
                id="marks-class"
                name="classId"
                defaultValue={selectedClass?.id ?? ""}
                className="border-input dark:bg-input/30 h-9 w-full rounded-md border bg-transparent px-2 text-sm"
              >
                <option value="">Select class...</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label htmlFor="marks-year" className="text-muted-foreground text-xs">
                Year
              </label>
              <select
                id="marks-year"
                name="year"
                defaultValue={year ? String(year) : ""}
                className="border-input dark:bg-input/30 h-9 w-full rounded-md border bg-transparent px-2 text-sm"
              >
                <option value="">All years</option>
                {/* Years come from the selected class's exams; plus the active one if set. */}
                {yearOptions(data?.years, year).map((y) => (
                  <option key={y} value={String(y)}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
            <Button type="submit" variant="outline">
              Apply
            </Button>
          </form>
        </CardContent>
      </Card>

      {!selectedClass || !data ? (
        <p className="text-muted-foreground text-sm">Pick a class above to see its exams.</p>
      ) : (
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-medium">
              Exams for {selectedClass.name}
              {year ? <span className="text-muted-foreground font-normal"> · {year}</span> : null}
            </h2>
            {isHead ? (
              <Button asChild size="sm">
                <Link href={`/exams/new?classId=${encodeURIComponent(selectedClass.id)}`}>
                  Create exam
                </Link>
              </Button>
            ) : null}
          </div>

          {data.exams.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No exams for this class{year ? ` in ${year}` : ""} yet.
            </p>
          ) : (
            <ul className="space-y-3">
              {data.exams.map((exam) => (
                <li key={exam.id}>
                  <Card>
                    <CardHeader>
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="space-y-1">
                          <CardTitle className="text-base">
                            <Link href={`/exams/${exam.id}`} className="hover:underline">
                              {exam.name}
                            </Link>
                          </CardTitle>
                          <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
                            <Badge variant="secondary">{EXAM_TYPE_LABELS[exam.type]}</Badge>
                            {exam.term ? <span>{exam.term}</span> : null}
                            {exam.startDate ? (
                              <span>{formatDay(exam.startDate)}</span>
                            ) : (
                              <span>{exam.year}</span>
                            )}
                            <span>
                              {exam.paperCount} {exam.paperCount === 1 ? "subject" : "subjects"}
                            </span>
                            <Badge variant={exam.isPublished ? "default" : "outline"}>
                              {exam.isPublished ? "Published" : "Draft"}
                            </Badge>
                          </div>
                        </div>
                        {isHead ? (
                          <DeleteButton action={deleteExamAction} id={exam.id} label={exam.name} />
                        ) : null}
                      </div>
                    </CardHeader>
                    <CardContent>
                      <Button asChild size="sm" variant="secondary">
                        <Link href={`/exams/${exam.id}`}>Open</Link>
                      </Button>
                    </CardContent>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}

/** The year dropdown values: the class's exam years, plus the active one if not already present. */
function yearOptions(years: number[] | undefined, active: number | null): number[] {
  const set = new Set(years ?? []);
  if (active != null) set.add(active);
  return [...set].sort((a, b) => b - a);
}
