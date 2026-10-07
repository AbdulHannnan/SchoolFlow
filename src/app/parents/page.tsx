import { Suspense } from "react";
import type { Metadata } from "next";

import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CreateParentForm } from "@/components/academics/create-parent-form";
import { LinkStudentForm } from "@/components/academics/link-student-form";
import { DeleteButton } from "@/components/academics/delete-button";
import { deleteParentAction, unlinkStudentAction } from "@/app/parents/actions";
import { requireRole } from "@/server/auth/dal";
import { listParents } from "@/server/academics/parents";
import { listStudents } from "@/server/academics/students";

export const metadata: Metadata = {
  title: "Parents - School Management",
};

export default function ParentsPage() {
  return (
    <AppShell title="Parents">
      <Suspense fallback={<div className="bg-muted h-64 animate-pulse rounded-xl" />}>
        <ParentsContent />
      </Suspense>
    </AppShell>
  );
}

function relationLabel(relation: string | null): string | null {
  if (!relation) return null;
  return relation.charAt(0) + relation.slice(1).toLowerCase();
}

async function ParentsContent() {
  await requireRole("HEAD");
  const [parents, students] = await Promise.all([listParents(), listStudents()]);

  const studentOptions = students.map((s) => ({
    id: s.id,
    label: `${s.name} - ${s.class.name}${s.section ? ` ${s.section.name}` : ""}`,
  }));

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Add a parent</CardTitle>
        </CardHeader>
        <CardContent>
          <CreateParentForm />
        </CardContent>
      </Card>

      {parents.length === 0 ? (
        <p className="text-muted-foreground text-sm">No parents yet. Add your first one above.</p>
      ) : (
        <div className="space-y-4">
          {parents.map((parent) => (
            <Card key={parent.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-base">{parent.name}</CardTitle>
                    <p className="text-muted-foreground text-sm">{parent.email}</p>
                  </div>
                  <DeleteButton action={deleteParentAction} id={parent.id} label={parent.name} />
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  {parent.parentLinks.length === 0 ? (
                    <span className="text-muted-foreground text-sm">No linked students.</span>
                  ) : (
                    parent.parentLinks.map((link) => (
                      <Badge key={link.id} variant="secondary" className="gap-1 pr-1">
                        {link.student.name}
                        <span className="text-muted-foreground">
                          - {link.student.class.name}
                          {relationLabel(link.relation) ? ` - ${relationLabel(link.relation)}` : ""}
                        </span>
                        <DeleteButton
                          action={unlinkStudentAction}
                          id={link.id}
                          label={`link to ${link.student.name}`}
                        />
                      </Badge>
                    ))
                  )}
                </div>
                {studentOptions.length === 0 ? (
                  <p className="text-muted-foreground text-xs">Add students first to link them.</p>
                ) : (
                  <LinkStudentForm parentId={parent.id} students={studentOptions} />
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
