import { Suspense } from "react";
import type { Metadata } from "next";

import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CreateClassForm } from "@/components/academics/create-class-form";
import { AddSectionForm } from "@/components/academics/add-section-form";
import { DeleteButton } from "@/components/academics/delete-button";
import { deleteClassAction, deleteSectionAction } from "@/app/classes/actions";
import { requireRole } from "@/server/auth/dal";
import { listClassesWithSections } from "@/server/academics/classes";

export const metadata: Metadata = {
  title: "Classes · School Management",
};

export default function ClassesPage() {
  return (
    <AppShell title="Classes & Sections">
      <Suspense fallback={<div className="bg-muted h-64 animate-pulse rounded-xl" />}>
        <ClassesContent />
      </Suspense>
    </AppShell>
  );
}

async function ClassesContent() {
  await requireRole("HEAD");
  const classes = await listClassesWithSections();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Add a class</CardTitle>
        </CardHeader>
        <CardContent>
          <CreateClassForm />
        </CardContent>
      </Card>

      {classes.length === 0 ? (
        <p className="text-muted-foreground text-sm">No classes yet. Add your first one above.</p>
      ) : (
        <div className="space-y-4">
          {classes.map((cls) => (
            <Card key={cls.id}>
              <CardHeader>
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-base">
                    {cls.name}
                    {cls.level != null ? (
                      <span className="text-muted-foreground ml-2 text-sm font-normal">
                        level {cls.level}
                      </span>
                    ) : null}
                  </CardTitle>
                  <DeleteButton action={deleteClassAction} id={cls.id} label={cls.name} />
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  {cls.sections.length === 0 ? (
                    <span className="text-muted-foreground text-sm">No sections.</span>
                  ) : (
                    cls.sections.map((section) => (
                      <Badge key={section.id} variant="secondary" className="gap-1 pr-1">
                        {section.name}
                        <DeleteButton
                          action={deleteSectionAction}
                          id={section.id}
                          label={`section ${section.name}`}
                        />
                      </Badge>
                    ))
                  )}
                </div>
                <AddSectionForm classId={cls.id} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
