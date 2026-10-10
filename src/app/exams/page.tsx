import { Suspense } from "react";
import Link from "next/link";
import { forbidden } from "next/navigation";
import type { Metadata } from "next";

import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ExamClassPicker } from "@/components/academics/exam-class-picker";
import { DeleteButton } from "@/components/academics/delete-button";
import { deleteExamAction } from "@/app/exams/actions";
import { verifySession } from "@/server/auth/dal";
import { listMarkableClasses } from "@/server/academics/attendance";
import { listChildrenExams, listExams } from "@/server/academics/exams";
import { formatDay } from "@/lib/attendance";
import { EXAM_TYPE_LABELS } from "@/lib/grades";

export const metadata: Metadata = {
  title: "Exams & Grades - School Management",
};

type SearchParams = Promise<{ classId?: string }>;

export default function ExamsPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <AppShell title="Exams & Grades">
      <Suspense fallback={<div className="bg-muted h-64 animate-pulse rounded-xl" />}>
        <ExamsContent searchParams={searchParams} />
      </Suspense>
    </AppShell>
  );
}

async function ExamsContent({ searchParams }: { searchParams: SearchParams }) {
  const user = await verifySession();

  if (user.role === "PARENT") return <ParentExams />;
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
  const data = selectedClass ? await listExams(selectedClass.id) : null;
  const isHead = user.role === "HEAD";

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Choose a class</CardTitle>
        </CardHeader>
        <CardContent>
          <ExamClassPicker
            classes={classes.map((c) => ({ id: c.id, name: c.name }))}
            selectedClassId={selectedClass?.id ?? ""}
          />
        </CardContent>
      </Card>

      {!selectedClass || !data ? (
        <p className="text-muted-foreground text-sm">Pick a class above to see its exams.</p>
      ) : (
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-medium">Exams for {selectedClass.name}</h2>
            {isHead ? (
              <Button asChild size="sm">
                <Link href={`/exams/new?classId=${encodeURIComponent(selectedClass.id)}`}>
                  Create exam
                </Link>
              </Button>
            ) : null}
          </div>

          {data.exams.length === 0 ? (
            <p className="text-muted-foreground text-sm">No exams for this class yet.</p>
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
                            {exam.startDate ? <span>{formatDay(exam.startDate)}</span> : null}
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

async function ParentExams() {
  const { children } = await listChildrenExams();

  if (children.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        No children are linked to your account yet. Please contact the school.
      </p>
    );
  }

  return (
    <div className="space-y-8">
      {children.map(({ student, exams }) => (
        <section key={student.id} className="space-y-3">
          <h2 className="text-sm font-medium">
            {student.name}
            <span className="text-muted-foreground ml-2 font-normal">
              {student.class.name}
              {student.section ? ` - ${student.section.name}` : ""}
            </span>
          </h2>
          {exams.length > 0 ? (
            <ul className="space-y-2">
              {exams.map((exam) => (
                <li key={exam.id}>
                  <Card>
                    <CardContent className="flex flex-wrap items-center justify-between gap-2 py-3">
                      <div className="space-y-1">
                        <p className="text-sm font-medium">{exam.name}</p>
                        <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
                          <Badge variant="secondary">{EXAM_TYPE_LABELS[exam.type]}</Badge>
                          {exam.term ? <span>{exam.term}</span> : null}
                          {exam.startDate ? <span>{formatDay(exam.startDate)}</span> : null}
                        </div>
                      </div>
                      <Button asChild size="sm" variant="secondary">
                        <Link href={`/exams/${exam.id}/students/${student.id}`}>
                          View report card
                        </Link>
                      </Button>
                    </CardContent>
                  </Card>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground text-sm">No published results yet.</p>
          )}
        </section>
      ))}
    </div>
  );
}
