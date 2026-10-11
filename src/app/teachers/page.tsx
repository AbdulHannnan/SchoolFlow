import { Suspense } from "react";
import Link from "next/link";
import { CalendarClock } from "lucide-react";
import type { Metadata } from "next";

import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { addBoxClass } from "@/components/ui/add-box";
import { CreateTeacherForm } from "@/components/academics/create-teacher-form";
import { DeleteButton } from "@/components/academics/delete-button";
import { deleteTeacherAction } from "@/app/teachers/actions";
import { requireRole } from "@/server/auth/dal";
import { listTeachers } from "@/server/academics/teachers";
import { listSubjects } from "@/server/academics/subjects";

export const metadata: Metadata = {
  title: "Teachers - School Management",
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
  const [teachers, subjects] = await Promise.all([listTeachers(), listSubjects()]);

  const subjectOptions = subjects.map((s) => ({ id: s.id, name: s.name }));

  return (
    <div className="space-y-6">
      <Card className={addBoxClass}>
        <CardHeader>
          <CardTitle className="text-base">Add a teacher</CardTitle>
        </CardHeader>
        <CardContent>
          <CreateTeacherForm subjects={subjectOptions} />
        </CardContent>
      </Card>

      {teachers.length === 0 ? (
        <p className="text-muted-foreground text-sm">No teachers yet. Add your first one above.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
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
                <div>
                  <p className="text-muted-foreground text-xs">Hired for (main subject)</p>
                  <p className="text-sm font-medium">{teacher.mainSubject?.name ?? "-"}</p>
                </div>
                <Button asChild variant="outline" size="sm">
                  <Link href={`/teachers/${teacher.id}`}>
                    <CalendarClock className="size-4" />
                    Timetable
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
