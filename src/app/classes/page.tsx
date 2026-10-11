import { Suspense } from "react";
import type { Metadata } from "next";

import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { addBoxClass } from "@/components/ui/add-box";
import { CreateClassForm } from "@/components/academics/create-class-form";
import { AddSectionForm } from "@/components/academics/add-section-form";
import { ClassActions } from "@/components/academics/class-actions";
import { SectionActions } from "@/components/academics/section-actions";
import { ClassSubjects } from "@/components/academics/class-subjects";
import { requireRole } from "@/server/auth/dal";
import {
  listClassesWithSections,
  listTeacherOptions,
  listSubjectOptions,
} from "@/server/academics/classes";
import { User as UserIcon, GraduationCap } from "lucide-react";

export const metadata: Metadata = {
  title: "Classes - School Management",
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
  const [classes, teachers, subjects] = await Promise.all([
    listClassesWithSections(),
    listTeacherOptions(),
    listSubjectOptions(),
  ]);

  return (
    <div className="space-y-6">
      <Card className={addBoxClass}>
        <CardHeader>
          <CardTitle className="text-base">Add a class</CardTitle>
        </CardHeader>
        <CardContent>
          <CreateClassForm teachers={teachers} />
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
                  <div className="flex items-center gap-1">
                    <ClassSubjects
                      classId={cls.id}
                      assignments={cls.teacherAssignments}
                      subjects={subjects}
                      teachers={teachers}
                    />
                    <ClassActions
                      id={cls.id}
                      name={cls.name}
                      level={cls.level}
                      classTeacherId={cls.classTeacherId}
                      studentCount={cls._count.students}
                      teachers={teachers}
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                  <span className="flex items-center gap-1.5">
                    <UserIcon className="size-4" />
                    {cls.classTeacher ? (
                      <span className="text-foreground font-medium">{cls.classTeacher.name}</span>
                    ) : (
                      "No class teacher"
                    )}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <GraduationCap className="size-4" />
                    <span className="text-foreground font-medium">{cls._count.students}</span>
                    {cls._count.students === 1 ? "student" : "students"}
                  </span>
                </div>
                {cls.sections.length === 0 ? (
                  <p className="text-muted-foreground text-sm">
                    {cls.hasSections
                      ? "No sections yet. Add the first one below."
                      : "No sections - students enrol directly into the class."}
                  </p>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {cls.sections.map((section) => (
                      <div key={section.id} className="bg-muted/30 rounded-lg border p-3">
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-medium">{section.name}</p>
                          <SectionActions
                            id={section.id}
                            name={section.name}
                            sectionTeacherId={section.sectionTeacherId}
                            teachers={teachers}
                          />
                        </div>
                        <div className="text-muted-foreground mt-1 space-y-1 text-sm">
                          <span className="flex items-center gap-1.5">
                            <UserIcon className="size-4" />
                            {section.sectionTeacher ? (
                              <span className="text-foreground">{section.sectionTeacher.name}</span>
                            ) : (
                              "No teacher"
                            )}
                          </span>
                          <span className="flex items-center gap-1.5">
                            <GraduationCap className="size-4" />
                            <span className="text-foreground">{section._count.students}</span>
                            {section._count.students === 1 ? "student" : "students"}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <AddSectionForm classId={cls.id} teachers={teachers} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
