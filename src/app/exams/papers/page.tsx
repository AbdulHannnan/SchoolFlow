import { Suspense } from "react";
import Link from "next/link";
import { forbidden } from "next/navigation";
import type { Metadata } from "next";
import type { ExamPaperStatus } from "@prisma/client";

import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { addBoxClass } from "@/components/ui/add-box";
import { SubmitPaperForm } from "@/components/academics/submit-paper-form";
import { ExamPaperStatusBadge } from "@/components/academics/exam-paper-status-badge";
import { DeleteButton } from "@/components/academics/delete-button";
import { deleteExamPaperAction, reviewExamPaperAction } from "@/app/exams/papers/actions";
import { verifySession } from "@/server/auth/dal";
import { listMarkableClasses } from "@/server/academics/attendance";
import { listSubjects } from "@/server/academics/subjects";
import {
  listExamPapersForReview,
  listMyExamPapers,
  type ExamPaperRow,
} from "@/server/academics/exam-papers";
import { formatDay, todayISODate } from "@/lib/attendance";

export const metadata: Metadata = {
  title: "Exam papers - School Management",
};

type SearchParams = Promise<{ classId?: string; status?: string }>;

export default function ExamPapersPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <AppShell title="Exam papers">
      <Suspense fallback={<div className="bg-muted h-64 animate-pulse rounded-xl" />}>
        <PapersContent searchParams={searchParams} />
      </Suspense>
    </AppShell>
  );
}

async function PapersContent({ searchParams }: { searchParams: SearchParams }) {
  const user = await verifySession();
  if (user.role === "TEACHER") return <TeacherPapers />;
  if (user.role !== "HEAD") forbidden();
  return <HeadPapers searchParams={searchParams} />;
}

/** A date-only value from the DB as the "YYYY-MM-DD" a date input expects. */
function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function BackButton() {
  return (
    <div className="flex justify-end">
      <Button asChild variant="outline" size="sm">
        <Link href="/exams">Back to exams</Link>
      </Button>
    </div>
  );
}

function PaperMeta({ row, showTeacher }: { row: ExamPaperRow; showTeacher: boolean }) {
  return (
    <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
      {showTeacher ? <span>{row.teacherName}</span> : null}
      <span>{row.className}</span>
      <span>{row.subjectName}</span>
      <span>{formatDay(row.examDate)}</span>
    </div>
  );
}

async function TeacherPapers() {
  const [classes, subjects, papers] = await Promise.all([
    listMarkableClasses(),
    listSubjects(),
    listMyExamPapers(),
  ]);
  const classOptions = classes.map((c) => ({ id: c.id, name: c.name }));
  const subjectOptions = subjects.map((s) => ({ id: s.id, name: s.name }));

  return (
    <div className="space-y-6">
      <BackButton />

      {classes.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          You have no classes to submit for. A head can assign you to one.
        </p>
      ) : (
        <Card className={addBoxClass}>
          <CardHeader>
            <CardTitle className="text-base">Submit a paper for review</CardTitle>
          </CardHeader>
          <CardContent>
            <SubmitPaperForm classes={classOptions} subjects={subjectOptions} today={todayISODate()} />
          </CardContent>
        </Card>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-medium">Your papers</h2>
        {papers.length === 0 ? (
          <p className="text-muted-foreground text-sm">No papers submitted yet.</p>
        ) : (
          <ul className="space-y-3">
            {papers.map((p) => (
              <li key={p.id}>
                <Card>
                  <CardHeader>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="space-y-1">
                        <CardTitle className="text-base">{p.title}</CardTitle>
                        <PaperMeta row={p} showTeacher={false} />
                      </div>
                      <ExamPaperStatusBadge status={p.status} />
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {p.notes ? <p className="text-sm whitespace-pre-wrap">{p.notes}</p> : null}
                    {p.status === "CHANGES_REQUESTED" && p.reviewNote ? (
                      <p className="border-destructive/30 text-destructive rounded-md border px-3 py-2 text-sm">
                        <span className="font-medium">Head&apos;s note:</span> {p.reviewNote}
                      </p>
                    ) : null}
                    <div className="flex flex-wrap items-center gap-2">
                      <Button asChild size="sm" variant="secondary">
                        <a href={p.fileUrl} target="_blank" rel="noopener noreferrer">
                          Open paper
                        </a>
                      </Button>
                      {p.status !== "APPROVED" ? (
                        <DeleteButton
                          action={deleteExamPaperAction}
                          id={p.id}
                          label={`paper ${p.title}`}
                        />
                      ) : null}
                    </div>
                    {p.status === "CHANGES_REQUESTED" ? (
                      <div className="border-t pt-3">
                        <p className="mb-2 text-sm font-medium">Revise &amp; re-submit</p>
                        <SubmitPaperForm
                          classes={classOptions}
                          subjects={subjectOptions}
                          today={todayISODate()}
                          paper={{
                            id: p.id,
                            classId: p.classId,
                            subjectId: p.subjectId,
                            title: p.title,
                            examDate: toISODate(p.examDate),
                            fileUrl: p.fileUrl,
                            notes: p.notes,
                          }}
                        />
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

const STATUS_FILTERS: { value: ExamPaperStatus; label: string }[] = [
  { value: "SUBMITTED", label: "Awaiting review" },
  { value: "CHANGES_REQUESTED", label: "Changes requested" },
  { value: "APPROVED", label: "Approved" },
];

async function HeadPapers({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const classes = await listMarkableClasses();
  const classId = classes.some((c) => c.id === sp.classId) ? sp.classId! : null;
  const status = STATUS_FILTERS.some((s) => s.value === sp.status)
    ? (sp.status as ExamPaperStatus)
    : null;

  const papers = await listExamPapersForReview({ classId, status });

  return (
    <div className="space-y-6">
      <BackButton />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filter</CardTitle>
        </CardHeader>
        <CardContent>
          <form method="get" className="grid items-end gap-4 sm:grid-cols-3">
            <div className="space-y-1">
              <label htmlFor="papers-class" className="text-muted-foreground text-xs">
                Class
              </label>
              <select
                id="papers-class"
                name="classId"
                defaultValue={classId ?? ""}
                className="border-input dark:bg-input/30 h-9 w-full rounded-md border bg-transparent px-2 text-sm"
              >
                <option value="">All classes</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label htmlFor="papers-status" className="text-muted-foreground text-xs">
                Status
              </label>
              <select
                id="papers-status"
                name="status"
                defaultValue={status ?? ""}
                className="border-input dark:bg-input/30 h-9 w-full rounded-md border bg-transparent px-2 text-sm"
              >
                <option value="">All statuses</option>
                {STATUS_FILTERS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
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

      <section className="space-y-3">
        <h2 className="text-sm font-medium">
          {papers.length} {papers.length === 1 ? "paper" : "papers"}
        </h2>
        {papers.length === 0 ? (
          <p className="text-muted-foreground text-sm">No papers match this filter.</p>
        ) : (
          <ul className="space-y-3">
            {papers.map((p) => (
              <li key={p.id}>
                <Card>
                  <CardHeader>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="space-y-1">
                        <CardTitle className="text-base">{p.title}</CardTitle>
                        <PaperMeta row={p} showTeacher />
                      </div>
                      <ExamPaperStatusBadge status={p.status} />
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {p.notes ? <p className="text-sm whitespace-pre-wrap">{p.notes}</p> : null}
                    {p.reviewNote ? (
                      <p className="text-muted-foreground text-sm">
                        <span className="font-medium">Your note:</span> {p.reviewNote}
                      </p>
                    ) : null}
                    <div className="flex flex-wrap items-center gap-2">
                      <Button asChild size="sm" variant="secondary">
                        <a href={p.fileUrl} target="_blank" rel="noopener noreferrer">
                          Open paper
                        </a>
                      </Button>
                      <DeleteButton
                        action={deleteExamPaperAction}
                        id={p.id}
                        label={`paper ${p.title}`}
                      />
                    </div>

                    {/* Review: two submit buttons share the optional note. */}
                    <form action={reviewExamPaperAction} className="space-y-2 border-t pt-3">
                      <input type="hidden" name="id" value={p.id} />
                      <Textarea
                        name="reviewNote"
                        rows={2}
                        defaultValue={p.reviewNote ?? ""}
                        placeholder="Optional note to the teacher (shown if you request changes)."
                      />
                      <div className="flex flex-wrap gap-2">
                        <Button type="submit" name="decision" value="APPROVED" size="sm">
                          Approve
                        </Button>
                        <Button
                          type="submit"
                          name="decision"
                          value="CHANGES_REQUESTED"
                          size="sm"
                          variant="secondary"
                        >
                          Request changes
                        </Button>
                      </div>
                    </form>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
