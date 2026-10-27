import { Suspense } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";

import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { addBoxClass } from "@/components/ui/add-box";
import { CreateSubjectForm } from "@/components/academics/create-subject-form";
import { DeleteButton } from "@/components/academics/delete-button";
import { ClassSubjectManager } from "@/components/academics/class-subject-manager";
import { deleteSubjectAction } from "@/app/subjects/actions";
import { requireRole } from "@/server/auth/dal";
import { listSubjects, listMySubjects } from "@/server/academics/subjects";
import {
  listClassesWithSections,
  getClassSubjects,
  listSubjectOptions,
  listTeacherOptions,
} from "@/server/academics/classes";

export const metadata: Metadata = {
  title: "Subjects - School Management",
};

type SearchParams = Promise<{ classId?: string }>;

export default function SubjectsPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <AppShell title="Subjects">
      <Suspense fallback={<div className="bg-muted h-64 animate-pulse rounded-xl" />}>
        <SubjectsContent searchParams={searchParams} />
      </Suspense>
    </AppShell>
  );
}

async function SubjectsContent({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireRole("HEAD", "TEACHER");

  // Teachers get a read-only view of the subjects they teach, by class.
  if (user.role === "TEACHER") {
    return <TeacherSubjects />;
  }

  const sp = await searchParams;
  if (sp.classId) {
    return <ClassSubjectsDetail classId={sp.classId} />;
  }
  return <SubjectsOverview />;
}

async function TeacherSubjects() {
  const subjects = await listMySubjects();

  if (subjects.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        You have no subjects assigned yet. Ask your head teacher to assign you a subject in a class.
      </p>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {subjects.map((subject) => (
        <Card key={subject.subjectId} className="h-full">
          <CardHeader>
            <CardTitle className="text-base">
              {subject.subjectName}
              {subject.code ? (
                <span className="text-muted-foreground ml-2 text-sm font-normal">
                  {subject.code}
                </span>
              ) : null}
            </CardTitle>
            <CardDescription>
              {subject.classes.length} {subject.classes.length === 1 ? "class" : "classes"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1.5">
              {subject.classes.map((cls) => (
                <Link
                  key={cls.id}
                  href={`/classes?classId=${encodeURIComponent(cls.id)}`}
                  className="focus-visible:ring-ring rounded-md focus-visible:ring-2 focus-visible:outline-none"
                >
                  <Badge variant="secondary" className="hover:bg-secondary/70">
                    {cls.name}
                    {cls.level != null ? (
                      <span className="text-muted-foreground ml-1">(level {cls.level})</span>
                    ) : null}
                  </Badge>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

async function SubjectsOverview() {
  const [subjects, classes] = await Promise.all([listSubjects(), listClassesWithSections()]);

  return (
    <div className="space-y-6">
      <Card className={addBoxClass}>
        <CardHeader>
          <CardTitle className="text-base">Add a subject</CardTitle>
        </CardHeader>
        <CardContent>
          <CreateSubjectForm />
        </CardContent>
      </Card>

      {subjects.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Subject catalogue</CardTitle>
            <CardDescription>
              The subjects this school offers. Assign them per class below.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center gap-2">
              {subjects.map((subject) => (
                <Badge key={subject.id} variant="secondary" className="gap-1 pr-1">
                  {subject.name}
                  <DeleteButton action={deleteSubjectAction} id={subject.id} label={subject.name} />
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-sm font-medium">Classes</h2>
        {classes.length === 0 ? (
          <p className="text-muted-foreground text-sm">Add a class first to define its subjects.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {classes.map((cls) => {
              const subjectCount = new Set(cls.teacherAssignments.map((a) => a.subjectId)).size;
              return (
                <Link
                  key={cls.id}
                  href={`/subjects?classId=${encodeURIComponent(cls.id)}`}
                  className="focus-visible:ring-ring rounded-xl focus-visible:ring-2 focus-visible:outline-none"
                >
                  <Card className="hover:border-primary/50 hover:bg-accent/40 h-full transition-colors">
                    <CardHeader>
                      <CardTitle className="text-base">
                        {cls.name}
                        {cls.level != null ? (
                          <span className="text-muted-foreground ml-2 text-sm font-normal">
                            level {cls.level}
                          </span>
                        ) : null}
                      </CardTitle>
                      <CardDescription>
                        {subjectCount} {subjectCount === 1 ? "subject" : "subjects"}
                      </CardDescription>
                    </CardHeader>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

async function ClassSubjectsDetail({ classId }: { classId: string }) {
  const [{ class: cls, assignments }, subjects, teachers] = await Promise.all([
    getClassSubjects(classId),
    listSubjectOptions(),
    listTeacherOptions(),
  ]);

  return (
    <div className="space-y-4">
      <Link
        href="/subjects"
        className="text-muted-foreground hover:text-foreground -ml-1 inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" />
        All classes
      </Link>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {cls.name} subjects
            <span className="text-muted-foreground ml-2 text-sm font-normal">
              {assignments.length} {assignments.length === 1 ? "subject" : "subjects"}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ClassSubjectManager
            classId={cls.id}
            assignments={assignments}
            subjects={subjects}
            teachers={teachers}
          />
        </CardContent>
      </Card>
    </div>
  );
}
