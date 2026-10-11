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
import { StudentActions } from "@/components/academics/student-actions";
import { requireRole } from "@/server/auth/dal";
import { listStudentsByClass } from "@/server/academics/students";
import { listClassesWithSections } from "@/server/academics/classes";
import { formatDay } from "@/lib/attendance";
import { ageFromDob, formatCnic, genderLabel } from "@/lib/students";

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

function Detail({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value ?? "-"}</dd>
    </div>
  );
}

async function ClassRoster({ classId }: { classId: string }) {
  const [{ class: cls, students }, classes] = await Promise.all([
    listStudentsByClass(classId),
    listClassesWithSections(),
  ]);
  const classOptions: ClassOption[] = classes.map((c) => ({
    id: c.id,
    name: c.name,
    sections: c.sections.map((s) => ({ id: s.id, name: s.name })),
  }));

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
            <ul className="space-y-3">
              {students.map((student) => (
                <li key={student.id} className="rounded-lg border p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">
                        {student.name}
                        {student.rollNumber ? (
                          <span className="text-muted-foreground ml-2 font-normal">
                            #{student.rollNumber}
                          </span>
                        ) : null}
                      </div>
                      <div className="text-muted-foreground mt-0.5 flex items-center gap-1.5 text-xs">
                        {student.section ? (
                          <Badge variant="secondary" className="px-1.5 py-0">
                            {student.section.name}
                          </Badge>
                        ) : (
                          <span className="italic">no section</span>
                        )}
                        <Badge
                          variant="outline"
                          className={
                            student.isActive
                              ? "border-transparent bg-green-100 px-1.5 py-0 text-green-700 dark:bg-green-900/40 dark:text-green-400"
                              : "border-transparent bg-neutral-200 px-1.5 py-0 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400"
                          }
                        >
                          {student.isActive ? "Enrolled" : "Not enrolled"}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Link
                        href={`/attendance/${student.id}`}
                        className="text-muted-foreground hover:text-foreground text-xs underline-offset-2 hover:underline"
                      >
                        Attendance
                      </Link>
                      <StudentActions student={student} classId={cls.id} classes={classOptions} />
                    </div>
                  </div>
                  <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-3">
                    <Detail label="Father" value={student.fatherName} />
                    <Detail
                      label="Father CNIC"
                      value={student.fatherCnic ? formatCnic(student.fatherCnic) : null}
                    />
                    <Detail label="Gender" value={genderLabel(student.gender)} />
                    <Detail
                      label="Date of birth"
                      value={student.dateOfBirth ? formatDay(student.dateOfBirth) : null}
                    />
                    <Detail
                      label="Age"
                      value={student.dateOfBirth ? `${ageFromDob(student.dateOfBirth)} yrs` : null}
                    />
                    <Detail
                      label="Admission"
                      value={student.admissionDate ? formatDay(student.admissionDate) : null}
                    />
                  </dl>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
