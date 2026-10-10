import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";

import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EnterResultsForm } from "@/components/academics/enter-results-form";
import { verifySession } from "@/server/auth/dal";
import { getPaperForEntry } from "@/server/academics/exams";

export const metadata: Metadata = {
  title: "Enter Marks - School Management",
};

// Dynamic route segments: render on demand (see the Cache Components notes).
export const instant = false;

type Params = Promise<{ examId: string; examSubjectId: string }>;

export default function EnterMarksPage({ params }: { params: Params }) {
  return (
    <AppShell title="Enter Marks">
      <Suspense fallback={<div className="bg-muted h-64 animate-pulse rounded-xl" />}>
        <EnterMarksContent params={params} />
      </Suspense>
    </AppShell>
  );
}

async function EnterMarksContent({ params }: { params: Params }) {
  // Role is gated here (HEAD/TEACHER); the service re-checks class assignment.
  const user = await verifySession();
  const { examId, examSubjectId } = await params;

  let data: Awaited<ReturnType<typeof getPaperForEntry>> | null = null;
  let error: string | null = null;
  try {
    data = await getPaperForEntry(examSubjectId);
  } catch (e) {
    error = e instanceof Error ? e.message : "Unable to load this paper.";
  }
  if (error || !data || (user.role !== "HEAD" && user.role !== "TEACHER")) {
    return (
      <p className="text-muted-foreground text-sm">{error ?? "This paper is not available."}</p>
    );
  }

  const { paper, roster } = data;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {paper.subjectName}
            <span className="text-muted-foreground ml-2 text-sm font-normal">
              {paper.examName} · {paper.className}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground text-sm">
            Maximum marks: {paper.maxMarks}
            {paper.passMarks ? ` · passing: ${paper.passMarks}` : ""}.{" "}
            <Link href={`/exams/${examId}`} className="underline underline-offset-4">
              Back to exam
            </Link>
          </p>
          {roster.length === 0 ? (
            <p className="text-muted-foreground text-sm">No active students in this class.</p>
          ) : (
            <EnterResultsForm examSubjectId={paper.id} maxMarks={paper.maxMarks} roster={roster} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
