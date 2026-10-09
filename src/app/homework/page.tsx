import { Suspense, type ReactNode } from "react";
import { forbidden } from "next/navigation";
import type { Metadata } from "next";
import type { DiaryType } from "@prisma/client";

import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DiaryClassPicker, type PostableClass } from "@/components/academics/diary-class-picker";
import { PostDiaryForm } from "@/components/academics/post-diary-form";
import { DeleteButton } from "@/components/academics/delete-button";
import { deleteDiaryEntryAction } from "@/app/homework/actions";
import { verifySession } from "@/server/auth/dal";
import { listMarkableClasses } from "@/server/academics/attendance";
import { listSubjects } from "@/server/academics/subjects";
import { listChildrenDiary, listClassDiary, type DiaryListEntry } from "@/server/academics/diary";
import { formatDay, todayISODate } from "@/lib/attendance";

export const metadata: Metadata = {
  title: "Homework - School Management",
};

type SearchParams = Promise<{ classId?: string; sectionId?: string }>;

export default function HomeworkPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <AppShell title="Homework & Diary">
      <Suspense fallback={<div className="bg-muted h-64 animate-pulse rounded-xl" />}>
        <HomeworkContent searchParams={searchParams} />
      </Suspense>
    </AppShell>
  );
}

async function HomeworkContent({ searchParams }: { searchParams: SearchParams }) {
  const user = await verifySession();

  if (user.role === "PARENT") return <ParentDiary />;
  if (user.role !== "TEACHER" && user.role !== "HEAD") forbidden();

  const sp = await searchParams;
  const classes = await listMarkableClasses();

  if (classes.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        You have no classes to post for. A head can assign you to one.
      </p>
    );
  }

  const selectedClass = classes.find((c) => c.id === sp.classId) ?? null;
  const sectionId =
    selectedClass && sp.sectionId && selectedClass.sections.some((s) => s.id === sp.sectionId)
      ? sp.sectionId
      : null;

  const classOptions: PostableClass[] = classes.map((c) => ({
    id: c.id,
    name: c.name,
    sections: c.sections,
  }));

  const [subjects, feed] = await Promise.all([
    listSubjects(),
    selectedClass ? listClassDiary({ classId: selectedClass.id, sectionId }) : null,
  ]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Choose a class</CardTitle>
        </CardHeader>
        <CardContent>
          <DiaryClassPicker
            classes={classOptions}
            selectedClassId={selectedClass?.id ?? ""}
            selectedSectionId={sectionId ?? ""}
          />
        </CardContent>
      </Card>

      {!selectedClass ? (
        <p className="text-muted-foreground text-sm">
          Pick a class above to post homework and see recent entries.
        </p>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Post to {selectedClass.name}
                {sectionId
                  ? ` - ${selectedClass.sections.find((s) => s.id === sectionId)?.name}`
                  : " (whole class)"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <PostDiaryForm
                classId={selectedClass.id}
                sectionId={sectionId ?? ""}
                subjects={subjects.map((s) => ({ id: s.id, name: s.name }))}
                today={todayISODate()}
              />
            </CardContent>
          </Card>

          <section className="space-y-3">
            <h2 className="text-sm font-medium">Recent entries</h2>
            {feed && feed.entries.length > 0 ? (
              <ul className="space-y-3">
                {feed.entries.map((entry) => (
                  <li key={entry.id}>
                    <DiaryEntryCard
                      entry={entry}
                      action={
                        <DeleteButton
                          action={deleteDiaryEntryAction}
                          id={entry.id}
                          label={entry.title}
                        />
                      }
                    />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground text-sm">Nothing posted yet.</p>
            )}
          </section>
        </>
      )}
    </div>
  );
}

async function ParentDiary() {
  const { children } = await listChildrenDiary();

  if (children.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        No children are linked to your account yet. Please contact the school.
      </p>
    );
  }

  return (
    <div className="space-y-8">
      {children.map(({ student, entries }) => (
        <section key={student.id} className="space-y-3">
          <h2 className="text-sm font-medium">
            {student.name}
            <span className="text-muted-foreground ml-2 font-normal">
              {student.class.name}
              {student.section ? ` - ${student.section.name}` : ""}
            </span>
          </h2>
          {entries.length > 0 ? (
            <ul className="space-y-3">
              {entries.map((entry) => (
                <li key={entry.id}>
                  <DiaryEntryCard entry={entry} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground text-sm">No homework or notes yet.</p>
          )}
        </section>
      ))}
    </div>
  );
}

function typeLabel(type: DiaryType): string {
  return type === "HOMEWORK" ? "Homework" : "Note";
}

function DiaryEntryCard({ entry, action }: { entry: DiaryListEntry; action?: ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="space-y-1">
            <CardTitle className="text-base">{entry.title}</CardTitle>
            <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
              <Badge variant={entry.type === "HOMEWORK" ? "default" : "secondary"}>
                {typeLabel(entry.type)}
              </Badge>
              {entry.subject ? <span>{entry.subject.name}</span> : null}
              {entry.section ? <span>Section {entry.section.name}</span> : null}
              <span>{formatDay(entry.date)}</span>
              {entry.dueDate ? <span>Due {formatDay(entry.dueDate)}</span> : null}
            </div>
          </div>
          {action ?? null}
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-sm whitespace-pre-wrap">{entry.content}</p>
        {entry.createdBy ? (
          <p className="text-muted-foreground text-xs">Posted by {entry.createdBy.name}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
