import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";

import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { setExamPublishedAction } from "@/app/exams/actions";
import { verifySession } from "@/server/auth/dal";
import { getExamOverview, listExamStudents } from "@/server/academics/exams";
import { formatDay } from "@/lib/attendance";
import { EXAM_TYPE_LABELS } from "@/lib/grades";

export const metadata: Metadata = {
  title: "Exam - School Management",
};

// Dynamic route: the shell's `usePathname()` has no statically-known path for an
// `[examId]` segment, so render on demand. See the Cache Components notes.
export const instant = false;

type Params = Promise<{ examId: string }>;

export default function ExamDetailPage({ params }: { params: Params }) {
  return (
    <AppShell title="Exam">
      <Suspense fallback={<div className="bg-muted h-64 animate-pulse rounded-xl" />}>
        <ExamDetailContent params={params} />
      </Suspense>
    </AppShell>
  );
}

async function ExamDetailContent({ params }: { params: Params }) {
  const user = await verifySession();
  const { examId } = await params;

  let data: Awaited<ReturnType<typeof getExamOverview>> | null = null;
  let students: Awaited<ReturnType<typeof listExamStudents>> = [];
  let error: string | null = null;
  try {
    [data, students] = await Promise.all([getExamOverview(examId), listExamStudents(examId)]);
  } catch (e) {
    error = e instanceof Error ? e.message : "Unable to load this exam.";
  }
  if (error || !data) {
    return <p className="text-muted-foreground text-sm">{error ?? "Exam not available."}</p>;
  }

  const { exam, papers, studentCount } = data;
  const isHead = user.role === "HEAD";

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <CardTitle className="text-base">
                {exam.name}
                <span className="text-muted-foreground ml-2 text-sm font-normal">
                  {exam.className}
                </span>
              </CardTitle>
              <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
                <Badge variant="secondary">{EXAM_TYPE_LABELS[exam.type]}</Badge>
                {exam.term ? <span>{exam.term}</span> : null}
                {exam.startDate ? <span>{formatDay(exam.startDate)}</span> : null}
                <Badge variant={exam.isPublished ? "default" : "outline"}>
                  {exam.isPublished ? "Published" : "Draft"}
                </Badge>
              </div>
            </div>
            {isHead ? (
              <form action={setExamPublishedAction}>
                <input type="hidden" name="examId" value={exam.id} />
                <input type="hidden" name="publish" value={exam.isPublished ? "0" : "1"} />
                <Button type="submit" size="sm" variant={exam.isPublished ? "outline" : "default"}>
                  {exam.isPublished ? "Unpublish" : "Publish"}
                </Button>
              </form>
            ) : null}
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            {studentCount} {studentCount === 1 ? "student" : "students"} in this class.
            {exam.isPublished
              ? " Results are visible to parents."
              : " Publish when results are ready to share with parents."}
          </p>
        </CardContent>
      </Card>

      <section className="space-y-3">
        <h2 className="text-sm font-medium">Subjects</h2>
        {papers.length === 0 ? (
          <p className="text-muted-foreground text-sm">This exam has no subjects.</p>
        ) : (
          <ul className="space-y-2">
            {papers.map((p) => (
              <li key={p.id}>
                <Card>
                  <CardContent className="flex flex-wrap items-center justify-between gap-2 py-3">
                    <div className="space-y-0.5 text-sm">
                      <p className="font-medium">{p.subjectName}</p>
                      <p className="text-muted-foreground text-xs">
                        Max {p.maxMarks}
                        {p.passMarks ? ` · pass ${p.passMarks}` : ""} · {p.entered}/{studentCount}{" "}
                        entered
                      </p>
                    </div>
                    <Button asChild size="sm" variant="secondary">
                      <Link href={`/exams/${exam.id}/papers/${p.id}`}>Enter marks</Link>
                    </Button>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium">Report cards</h2>
        {students.length === 0 ? (
          <p className="text-muted-foreground text-sm">No active students in this class.</p>
        ) : (
          <ul className="divide-border divide-y rounded-md border">
            {students.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                <span>
                  {s.rollNumber ? (
                    <span className="text-muted-foreground mr-2">{s.rollNumber}</span>
                  ) : null}
                  {s.name}
                  {s.section ? (
                    <span className="text-muted-foreground ml-2 text-xs">{s.section.name}</span>
                  ) : null}
                </span>
                <Link
                  href={`/exams/${exam.id}/students/${s.id}`}
                  className="text-sm underline-offset-4 hover:underline"
                >
                  View
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
