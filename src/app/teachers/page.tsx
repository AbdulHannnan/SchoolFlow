import { Suspense } from "react";
import type { Metadata } from "next";

import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CreateTeacherForm } from "@/components/academics/create-teacher-form";
import { AssignTeacherForm } from "@/components/academics/assign-teacher-form";
import { DeleteButton } from "@/components/academics/delete-button";
import { deleteTeacherAction, deleteAssignmentAction } from "@/app/teachers/actions";
import { requireRole } from "@/server/auth/dal";
import { listTeachers } from "@/server/academics/teachers";
import { listSubjects } from "@/server/academics/subjects";
import { listClassesWithSections } from "@/server/academics/classes";

export const metadata: Metadata = {
  title: "Teachers · School Management",
};

export default function TeachersPage() {
  return (
    <AppShell title="Teachers">
      <Suspense fallback={<div className="bg-muted h-64 animate-pulse rounded-xl" />}>
        <TeachersContent />
      </Suspense>
    </AppShell>
  );
}

async function TeachersContent() {
  await requireRole("HEAD");
  const [teachers, subjects, classes] = await Promise.all([
    listTeachers(),
    listSubjects(),
    listClassesWithSections(),
  ]);

  const subjectOptions = subjects.map((s) => ({ id: s.id, name: s.name }));
  const classOptions = classes.map((c) => ({ id: c.id, name: c.name }));

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Add a teacher</CardTitle>
        </CardHeader>
        <CardContent>
          <CreateTeacherForm />
        </CardContent>
      </Card>

      {teachers.length === 0 ? (
        <p className="text-muted-foreground text-sm">No teachers yet. Add your first one above.</p>
      ) : (
        <div className="space-y-4">
          {teachers.map((teacher) => (
            <Card key={teacher.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-base">{teacher.name}</CardTitle>
                    <p className="text-muted-foreground text-sm">{teacher.email}</p>
                  </div>
                  <DeleteButton action={deleteTeacherAction} id={teacher.id} label={teacher.name} />
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  {teacher.teacherAssignments.length === 0 ? (
                    <span className="text-muted-foreground text-sm">No assignments.</span>
                  ) : (
                    teacher.teacherAssignments.map((a) => (
                      <Badge key={a.id} variant="secondary" className="gap-1 pr-1">
                        {a.subject.name} · {a.class.name}
                        <DeleteButton
                          action={deleteAssignmentAction}
                          id={a.id}
                          label={`${a.subject.name} in ${a.class.name}`}
                        />
                      </Badge>
                    ))
                  )}
                </div>
                <AssignTeacherForm
                  teacherId={teacher.id}
                  subjects={subjectOptions}
                  classes={classOptions}
                />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
