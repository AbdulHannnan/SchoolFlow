import { Suspense } from "react";
import Link from "next/link";
import { ArrowLeft, GraduationCap } from "lucide-react";
import type { Metadata } from "next";

import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { addBoxClass } from "@/components/ui/add-box";
import { CreateStudentForm, type ClassOption } from "@/components/academics/create-student-form";
import { DeleteButton } from "@/components/academics/delete-button";
import { deleteStudentAction } from "@/app/students/actions";
import { requireRole } from "@/server/auth/dal";
import { listStudentsByClass } from "@/server/academics/students";
import { listClassesWithSections } from "@/server/academics/classes";

export const metadata: Metadata = {
  title: "Students - School Management",
};

type SearchParams = Promise<{ classId?: string }>;

export default function StudentsPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <AppShell title="Students">
      <Suspense fallback={<div className="bg-muted h-64 animate-pulse rounded-xl" />}>
        <StudentsContent searchParams={searchParams} />
      </Suspense>
    </AppShell>
  );
}

async function StudentsContent({ searchParams }: { searchParams: SearchParams }) {
  await requireRole("HEAD");
  const sp = await searchParams;

  // Drill-down: a selected class shows its roster; otherwise the overview.
  if (sp.classId) {
    return <ClassRoster classId={sp.classId} />;
  }
  return <StudentsOverview />;
}

async function StudentsOverview() {
  const classes = await listClassesWithSections();
  const classOptions: ClassOption[] = classes.map((c) => ({
    id: c.id,
    name: c.name,
    sections: c.sections.map((s) => ({ id: s.id, name: s.name })),
  }));
  const total = classes.reduce((n, c) => n + c._count.students, 0);

  return (
    <div className="space-y-6">
      <Card className={addBoxClass}>
        <CardHeader>
          <CardTitle className="text-base">Add a student</CardTitle>
        </CardHeader>
        <CardContent>
          {classes.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Add a class first - students must be enrolled in one.
            </p>
          ) : (
            <CreateStudentForm classes={classOptions} />
          )}
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        <div className="bg-muted grid size-12 place-items-center rounded-xl">
          <GraduationCap className="size-6" />
        </div>
        <div>
          <p className="text-2xl font-semibold">{total}</p>
          <p className="text-muted-foreground text-sm">
            {total === 1 ? "student" : "students"} across {classes.length}{" "}
            {classes.length === 1 ? "class" : "classes"}
          </p>
        </div>
      </div>

      {classes.length === 0 ? (
        <p className="text-muted-foreground text-sm">No classes yet. Add one to enrol students.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {classes.map((cls) => (
            <Link
              key={cls.id}
              href={`/students?classId=${encodeURIComponent(cls.id)}`}
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
                    {cls._count.students} {cls._count.students === 1 ? "student" : "students"}
                  </CardDescription>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

async function ClassRoster({ classId }: { classId: string }) {
  const { class: cls, students } = await listStudentsByClass(classId);

  return (
    <div className="space-y-4">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/students">
          <ArrowLeft className="size-4" />
          All classes
        </Link>
      </Button>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {cls.name}
            <span className="text-muted-foreground ml-2 text-sm font-normal">
              {students.length} {students.length === 1 ? "student" : "students"}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {students.length === 0 ? (
            <p className="text-muted-foreground text-sm">No students in this class yet.</p>
          ) : (
            <ul className="divide-border divide-y">
              {students.map((student) => (
                <li key={student.id} className="flex items-center justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">
                      {student.name}
                      {student.rollNumber ? (
                        <span className="text-muted-foreground ml-2 font-normal">
                          #{student.rollNumber}
                        </span>
                      ) : null}
                    </div>
                    <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
                      {student.section ? (
                        <Badge variant="secondary" className="px-1.5 py-0">
                          {student.section.name}
                        </Badge>
                      ) : (
                        <span className="italic">no section</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Link
                      href={`/attendance/${student.id}`}
                      className="text-muted-foreground hover:text-foreground text-xs underline-offset-2 hover:underline"
                    >
                      Attendance
                    </Link>
                    <DeleteButton
                      action={deleteStudentAction}
                      id={student.id}
                      label={student.name}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
