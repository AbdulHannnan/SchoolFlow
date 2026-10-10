import { Suspense } from "react";
import Link from "next/link";
import { forbidden } from "next/navigation";
import type { Metadata } from "next";

import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CreateExamForm } from "@/components/academics/create-exam-form";
import { verifySession } from "@/server/auth/dal";
import { listMarkableClasses } from "@/server/academics/attendance";
import { listSubjects } from "@/server/academics/subjects";
import { todayISODate } from "@/lib/attendance";

export const metadata: Metadata = {
  title: "New Exam - School Management",
};

type SearchParams = Promise<{ classId?: string }>;

export default function NewExamPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <AppShell title="New Exam">
      <Suspense fallback={<div className="bg-muted h-64 animate-pulse rounded-xl" />}>
        <NewExamContent searchParams={searchParams} />
      </Suspense>
    </AppShell>
  );
}

async function NewExamContent({ searchParams }: { searchParams: SearchParams }) {
  const user = await verifySession();
  if (user.role !== "HEAD") forbidden();

  const { classId } = await searchParams;
  const [classes, subjects] = await Promise.all([listMarkableClasses(), listSubjects()]);
  const selectedClass = classes.find((c) => c.id === classId) ?? null;

  if (!selectedClass) {
    return (
      <p className="text-muted-foreground text-sm">
        Pick a class from the{" "}
        <Link href="/exams" className="underline">
          exams page
        </Link>{" "}
        first.
      </p>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">New exam for {selectedClass.name}</CardTitle>
      </CardHeader>
      <CardContent>
        <CreateExamForm
          classId={selectedClass.id}
          className={selectedClass.name}
          subjects={subjects.map((s) => ({ id: s.id, name: s.name }))}
          today={todayISODate()}
        />
      </CardContent>
    </Card>
  );
}
