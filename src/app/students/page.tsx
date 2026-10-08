import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";

import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CreateStudentForm, type ClassOption } from "@/components/academics/create-student-form";
import { DeleteButton } from "@/components/academics/delete-button";
import { deleteStudentAction } from "@/app/students/actions";
import { requireRole } from "@/server/auth/dal";
import { listStudents } from "@/server/academics/students";
import { listClassesWithSections } from "@/server/academics/classes";

export const metadata: Metadata = {
  title: "Students - School Management",
};

export default function StudentsPage() {
  return (
    <AppShell title="Students">
      <Suspense fallback={<div className="bg-muted h-64 animate-pulse rounded-xl" />}>
        <StudentsContent />
      </Suspense>
    </AppShell>
  );
}

async function StudentsContent() {
  await requireRole("HEAD");
  const [students, classes] = await Promise.all([listStudents(), listClassesWithSections()]);

  const classOptions: ClassOption[] = classes.map((c) => ({
    id: c.id,
    name: c.name,
    sections: c.sections.map((s) => ({ id: s.id, name: s.name })),
  }));

  return (
    <div className="space-y-6">
      <Card>
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

      {students.length === 0 ? (
        <p className="text-muted-foreground text-sm">No students yet.</p>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {students.length} {students.length === 1 ? "student" : "students"}
            </CardTitle>
          </CardHeader>
          <CardContent>
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
                      <span>{student.class.name}</span>
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
          </CardContent>
        </Card>
      )}
    </div>
  );
}
