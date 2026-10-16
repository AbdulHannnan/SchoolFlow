import { Suspense } from "react";
import Link from "next/link";
import { forbidden } from "next/navigation";
import { ClipboardList, FileText } from "lucide-react";
import type { Metadata } from "next";

import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { verifySession } from "@/server/auth/dal";
import { listChildrenExams } from "@/server/academics/exams";
import { countExamPapersByStatus } from "@/server/academics/exam-papers";
import { formatDay } from "@/lib/attendance";
import { EXAM_TYPE_LABELS } from "@/lib/grades";

export const metadata: Metadata = {
  title: "Exams - School Management",
};

// The landing is entirely per-user (session role + the HEAD's paper counts) and
// has no URL data to key a prerender on, so render it on demand rather than
// prerendering a static shell for instant navigation. See the Cache Components
// notes; same reason the `[examId]` pages set this.
export const instant = false;

export default function ExamsPage() {
  return (
    <AppShell title="Exams">
      <Suspense fallback={<div className="bg-muted h-64 animate-pulse rounded-xl" />}>
        <ExamsContent />
      </Suspense>
    </AppShell>
  );
}

async function ExamsContent() {
  const user = await verifySession();
  if (user.role === "PARENT") return <ParentExams />;
  if (user.role !== "TEACHER" && user.role !== "HEAD") forbidden();
  return <StaffExamBlocks isHead={user.role === "HEAD"} />;
}

async function StaffExamBlocks({ isHead }: { isHead: boolean }) {
  // Only the HEAD gets the review backlog figure on the Papers block.
  const counts = isHead ? await countExamPapersByStatus() : null;

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">
        {isHead
          ? "Review question papers before each exam, and open the marks register for a class."
          : "Submit your question papers for review, and enter marks for your classes."}
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <ExamBlock
          href="/exams/papers"
          icon={<FileText className="text-muted-foreground size-5" />}
          title="Papers"
          description={
            isHead
              ? "Question papers teachers submit ahead of each exam, for you to review."
              : "Submit a question paper before the exam and track the head's review."
          }
          footer={
            counts ? (
              <div className="flex flex-wrap gap-2">
                <Badge variant={counts.submitted > 0 ? "default" : "outline"}>
                  {counts.submitted} awaiting review
                </Badge>
                {counts.changesRequested > 0 ? (
                  <Badge variant="secondary">{counts.changesRequested} with changes</Badge>
                ) : null}
              </div>
            ) : null
          }
        />
        <ExamBlock
          href="/exams/marks"
          icon={<ClipboardList className="text-muted-foreground size-5" />}
          title="Marks"
          description="Exams, grade entry and report cards, filtered by class and year."
        />
      </div>
    </div>
  );
}

function ExamBlock({
  href,
  icon,
  title,
  description,
  footer,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  footer?: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="focus-visible:ring-ring rounded-xl focus-visible:ring-2 focus-visible:outline-none"
    >
      <Card className="hover:border-primary/50 hover:bg-accent/40 h-full transition-colors">
        <CardHeader>
          <div className="flex items-center gap-2">
            {icon}
            <CardTitle>{title}</CardTitle>
          </div>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        {footer ? <CardContent>{footer}</CardContent> : null}
      </Card>
    </Link>
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
