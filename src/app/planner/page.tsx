import { Suspense, type ReactNode } from "react";
import { forbidden } from "next/navigation";
import type { Metadata } from "next";
import type { PlannerStatus } from "@prisma/client";

import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { addBoxClass } from "@/components/ui/add-box";
import { cn } from "@/lib/utils";
import { PlannerForm } from "@/components/academics/planner-form";
import { PlannerStatusToggle } from "@/components/academics/planner-status-toggle";
import { DeleteButton } from "@/components/academics/delete-button";
import { deletePlannerEntryAction } from "@/app/planner/actions";
import { verifySession } from "@/server/auth/dal";
import { listMarkableClasses } from "@/server/academics/attendance";
import { listSubjects } from "@/server/academics/subjects";
import { listTeachers } from "@/server/academics/teachers";
import {
  listMyPlanner,
  listPlannerRegister,
  type PlannerListEntry,
} from "@/server/academics/planner";
import { formatDay, presetRange, todayISODate } from "@/lib/attendance";

export const metadata: Metadata = {
  title: "Planner - School Management",
};

type SearchParams = Promise<{ from?: string; to?: string; teacherId?: string }>;

export default function PlannerPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <AppShell title="Planner register">
      <Suspense fallback={<div className="bg-muted h-64 animate-pulse rounded-xl" />}>
        <PlannerContent searchParams={searchParams} />
      </Suspense>
    </AppShell>
  );
}

const isISODate = (v: string | undefined): v is string => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);

async function PlannerContent({ searchParams }: { searchParams: SearchParams }) {
  const user = await verifySession();
  if (user.role !== "TEACHER" && user.role !== "HEAD") forbidden();

  const sp = await searchParams;
  const week = presetRange("week");
  const from = isISODate(sp.from) ? sp.from : week.from;
  const to = isISODate(sp.to) ? sp.to : week.to;

  if (user.role === "TEACHER") {
    return <TeacherPlanner from={from} to={to} />;
  }
  return <HeadRegister from={from} to={to} teacherId={sp.teacherId ?? ""} />;
}

async function TeacherPlanner({ from, to }: { from: string; to: string }) {
  const [classes, subjects, mine] = await Promise.all([
    listMarkableClasses(),
    listSubjects(),
    listMyPlanner({ from: new Date(from), to: new Date(to) }),
  ]);

  if (classes.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        You have no classes to plan for. A head can assign you to one.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <Card className={addBoxClass}>
        <CardHeader>
          <CardTitle className="text-base">Add to your planner</CardTitle>
        </CardHeader>
        <CardContent>
          <PlannerForm
            classes={classes.map((c) => ({ id: c.id, name: c.name }))}
            subjects={subjects.map((s) => ({ id: s.id, name: s.name }))}
            today={todayISODate()}
          />
        </CardContent>
      </Card>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-medium">My planner</h2>
          <DateFilter from={from} to={to} />
        </div>
        <PlannerList entries={mine} showTeacher={false} canToggle />
      </section>
    </div>
  );
}

async function HeadRegister({
  from,
  to,
  teacherId,
}: {
  from: string;
  to: string;
  teacherId: string;
}) {
  const [teachers, register] = await Promise.all([
    listTeachers(),
    listPlannerRegister({
      teacherId: teacherId || null,
      from: new Date(from),
      to: new Date(to),
    }),
  ]);

  // Group the register entries under the teacher who owns them.
  const byTeacher = new Map<string, PlannerListEntry[]>();
  for (const entry of register) {
    const list = byTeacher.get(entry.teacher.id) ?? [];
    list.push(entry);
    byTeacher.set(entry.teacher.id, list);
  }

  // One box per teacher; narrow to a single teacher when one is selected.
  const shown = teacherId ? teachers.filter((t) => t.id === teacherId) : teachers;

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">
        The lesson-plan register, one box per teacher. Filter by teacher or date range.
      </p>
      <DateFilter
        from={from}
        to={to}
        teacherId={teacherId}
        teachers={teachers.map((t) => ({ id: t.id, name: t.name }))}
      />

      {shown.length === 0 ? (
        <p className="text-muted-foreground text-sm">No teachers yet.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {shown.map((t) => (
            <TeacherPlannerBox key={t.id} name={t.name} entries={byTeacher.get(t.id) ?? []} />
          ))}
        </div>
      )}
    </div>
  );
}

/** A HEAD's per-teacher box: the teacher's name and their plans in the range. */
function TeacherPlannerBox({ name, entries }: { name: string; entries: PlannerListEntry[] }) {
  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base">{name}</CardTitle>
          <Badge variant="secondary">
            {entries.length} {entries.length === 1 ? "plan" : "plans"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <p className="text-muted-foreground text-sm">No plans in this range.</p>
        ) : (
          <ul className="divide-border divide-y">
            {entries.map((entry) => (
              <li key={entry.id} className="py-3 first:pt-0 last:pb-0">
                <PlannerEntryItem entry={entry} />
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

/** A compact plan inside a teacher box (no nested Card). The HEAD may delete it. */
function PlannerEntryItem({ entry }: { entry: PlannerListEntry }) {
  return (
    <div className="space-y-1">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 space-y-1">
          <p className="font-medium">{entry.topic}</p>
          <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
            {statusBadge(entry.status)}
            <span>{entry.class.name}</span>
            <span>{entry.subject.name}</span>
            <span>{formatDay(entry.date)}</span>
          </div>
        </div>
        <DeleteButton action={deletePlannerEntryAction} id={entry.id} label={entry.topic} />
      </div>
      <p className="text-sm whitespace-pre-wrap">{entry.details}</p>
      {entry.homework ? (
        <p className="text-muted-foreground text-sm">
          <span className="font-medium">Homework:</span> {entry.homework}
        </p>
      ) : null}
    </div>
  );
}

/** A server-rendered GET filter: date range, plus a teacher picker for the HEAD. */
function DateFilter({
  from,
  to,
  teacherId,
  teachers,
}: {
  from: string;
  to: string;
  teacherId?: string;
  teachers?: { id: string; name: string }[];
}) {
  const selectClass = cn(
    "border-input dark:bg-input/30 h-9 w-full rounded-md border bg-transparent px-2 text-sm shadow-xs outline-none",
    "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
  );
  return (
    <form method="get" className="flex flex-wrap items-end gap-3">
      {teachers ? (
        <div className="space-y-1">
          <Label htmlFor="planner-teacher" className="text-xs">
            Teacher
          </Label>
          <select
            id="planner-teacher"
            name="teacherId"
            defaultValue={teacherId ?? ""}
            className={cn(selectClass, "w-44")}
          >
            <option value="">All teachers</option>
            {teachers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
      ) : null}
      <div className="space-y-1">
        <Label htmlFor="planner-from" className="text-xs">
          From
        </Label>
        <Input
          id="planner-from"
          name="from"
          type="date"
          defaultValue={from}
          max={todayISODate()}
          className="w-40"
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="planner-to" className="text-xs">
          To
        </Label>
        <Input
          id="planner-to"
          name="to"
          type="date"
          defaultValue={to}
          max={todayISODate()}
          className="w-40"
        />
      </div>
      <Button type="submit" variant="outline">
        Apply
      </Button>
    </form>
  );
}

function PlannerList({
  entries,
  showTeacher,
  canToggle,
}: {
  entries: PlannerListEntry[];
  showTeacher: boolean;
  canToggle: boolean;
}) {
  if (entries.length === 0) {
    return <p className="text-muted-foreground text-sm">No plans in this range.</p>;
  }
  return (
    <ul className="space-y-3">
      {entries.map((entry) => (
        <li key={entry.id}>
          <PlannerEntryCard
            entry={entry}
            showTeacher={showTeacher}
            actions={
              <div className="flex items-center gap-2">
                {canToggle ? <PlannerStatusToggle id={entry.id} status={entry.status} /> : null}
                <DeleteButton action={deletePlannerEntryAction} id={entry.id} label={entry.topic} />
              </div>
            }
          />
        </li>
      ))}
    </ul>
  );
}

function statusBadge(status: PlannerStatus): ReactNode {
  return status === "COMPLETED" ? (
    <Badge className="border-transparent bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400">
      Taught
    </Badge>
  ) : (
    <Badge variant="secondary">Planned</Badge>
  );
}

function PlannerEntryCard({
  entry,
  showTeacher,
  actions,
}: {
  entry: PlannerListEntry;
  showTeacher: boolean;
  actions: ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="space-y-1">
            <CardTitle className="text-base">{entry.topic}</CardTitle>
            <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
              {statusBadge(entry.status)}
              <span>{entry.class.name}</span>
              <span>{entry.subject.name}</span>
              <span>{formatDay(entry.date)}</span>
              {showTeacher ? <span>{entry.teacher.name}</span> : null}
            </div>
          </div>
          {actions}
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-sm whitespace-pre-wrap">{entry.details}</p>
        {entry.homework ? (
          <p className="text-muted-foreground text-sm">
            <span className="font-medium">Homework:</span> {entry.homework}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
