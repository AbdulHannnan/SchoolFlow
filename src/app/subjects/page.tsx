import { Suspense } from "react";
import type { Metadata } from "next";

import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CreateSubjectForm } from "@/components/academics/create-subject-form";
import { DeleteButton } from "@/components/academics/delete-button";
import { deleteSubjectAction } from "@/app/subjects/actions";
import { requireRole } from "@/server/auth/dal";
import { listSubjects } from "@/server/academics/subjects";

export const metadata: Metadata = {
  title: "Subjects - School Management",
};

export default function SubjectsPage() {
  return (
    <AppShell title="Subjects">
      <Suspense fallback={<div className="bg-muted h-64 animate-pulse rounded-xl" />}>
        <SubjectsContent />
      </Suspense>
    </AppShell>
  );
}

async function SubjectsContent() {
  await requireRole("HEAD");
  const subjects = await listSubjects();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Add a subject</CardTitle>
        </CardHeader>
        <CardContent>
          <CreateSubjectForm />
        </CardContent>
      </Card>

      {subjects.length === 0 ? (
        <p className="text-muted-foreground text-sm">No subjects yet. Add your first one above.</p>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {subjects.length} {subjects.length === 1 ? "subject" : "subjects"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-border divide-y">
              {subjects.map((subject) => (
                <li key={subject.id} className="flex items-center justify-between gap-2 py-2">
                  <span className="flex items-center gap-2 text-sm">
                    {subject.name}
                    {subject.code ? (
                      <Badge variant="secondary" className="font-mono">
                        {subject.code}
                      </Badge>
                    ) : null}
                  </span>
                  <DeleteButton action={deleteSubjectAction} id={subject.id} label={subject.name} />
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
