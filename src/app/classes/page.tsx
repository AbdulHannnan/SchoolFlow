import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";

import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { addBoxClass } from "@/components/ui/add-box";
import { CreateClassForm } from "@/components/academics/create-class-form";
import { AddSectionForm } from "@/components/academics/add-section-form";
import { ClassActions } from "@/components/academics/class-actions";
import { SectionActions } from "@/components/academics/section-actions";
import { ClassSubjects } from "@/components/academics/class-subjects";
import { StudentRosterList } from "@/components/academics/student-roster-list";
import { MarkAttendanceForm } from "@/components/academics/mark-attendance-form";
import { InvoiceStatusBadge } from "@/components/fees/invoice-status-badge";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  currentMonth,
  monthLabel,
  normalizeDate,
  normalizeMonth,
  shiftMonth,
} from "@/lib/attendance";
import { formatPKR } from "@/lib/money";
import { requireRole } from "@/server/auth/dal";
import {
  listClassesWithSections,
  listMyClassesWithSections,
  listTeacherOptions,
  listSubjectOptions,
} from "@/server/academics/classes";
import { listMyClassStudents } from "@/server/academics/students";
import {
  getClassAttendanceForDate,
  getClassAttendanceMonth,
} from "@/server/academics/attendance";
import { listMyClassInvoices } from "@/server/fees/invoices";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  User as UserIcon,
  GraduationCap,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Classes - School Management",
};

type TabKey = "info" | "attendance" | "fee";
type SearchParams = Promise<{
  classId?: string;
  tab?: string;
  date?: string;
  month?: string;
}>;

export default function ClassesPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <AppShell title="Classes & Sections">
      <Suspense fallback={<div className="bg-muted h-64 animate-pulse rounded-xl" />}>
        <ClassesContent searchParams={searchParams} />
      </Suspense>
    </AppShell>
  );
}

async function ClassesContent({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireRole("HEAD", "TEACHER");

  // Teachers get a read-only view scoped to the classes they're assigned to.
  if (user.role === "TEACHER") {
    const sp = await searchParams;
    // Drill-down: a selected class shows its tabbed detail; otherwise the list.
    if (sp.classId) {
      const tab: TabKey =
        sp.tab === "attendance" || sp.tab === "fee" ? sp.tab : "info";
      return (
        <TeacherClassDetail classId={sp.classId} tab={tab} date={sp.date} month={sp.month} />
      );
    }
    return <TeacherClasses teacherId={user.id} />;
  }

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

/**
 * Read-only Classes view for a signed-in teacher: the classes they're assigned
 * to, each with its sections and the subjects this teacher teaches there. No
 * add/edit controls - management stays with HEAD.
 */
async function TeacherClasses({ teacherId }: { teacherId: string }) {
  const classes = await listMyClassesWithSections();

  if (classes.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        You have no classes assigned yet. Ask your head teacher to assign you a subject in a class.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {classes.map((cls) => {
        const mySubjects = cls.teacherAssignments.filter((a) => a.teacherId === teacherId);
        return (
          <Link
            key={cls.id}
            href={`/classes?classId=${encodeURIComponent(cls.id)}`}
            className="focus-visible:ring-ring block rounded-xl focus-visible:ring-2 focus-visible:outline-none"
          >
            <Card className="hover:border-primary/50 hover:bg-accent/40 transition-colors">
              <CardHeader>
                <CardTitle className="text-base">
                  {cls.name}
                  {cls.level != null ? (
                    <span className="text-muted-foreground ml-2 text-sm font-normal">
                      level {cls.level}
                    </span>
                  ) : null}
                </CardTitle>
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

              {mySubjects.length > 0 ? (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-muted-foreground text-sm">You teach:</span>
                  {mySubjects.map((a) => (
                    <Badge key={a.id} variant="secondary">
                      {a.subject.name}
                    </Badge>
                  ))}
                </div>
              ) : null}

              {cls.sections.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  {cls.hasSections
                    ? "No sections yet."
                    : "No sections - students enrol directly into the class."}
                </p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {cls.sections.map((section) => (
                    <div key={section.id} className="bg-muted/30 rounded-lg border p-3">
                      <p className="font-medium">{section.name}</p>
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
              </CardContent>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}

const TEACHER_TABS: { key: TabKey; label: string }[] = [
  { key: "info", label: "Student information" },
  { key: "attendance", label: "Attendance" },
  { key: "fee", label: "Fee" },
];

/**
 * A teacher's read-only detail for one of their classes, with three tabs:
 * the student roster (same details HEAD sees), attendance for today and the
 * previous day, and the class's fee invoices. Tabs are plain links that set
 * `?tab=` so the view stays server-rendered; ownership is enforced in each
 * tab's data read.
 */
async function TeacherClassDetail({
  classId,
  tab,
  date,
  month,
}: {
  classId: string;
  tab: TabKey;
  date?: string;
  month?: string;
}) {
  // Verifies ownership and gives the class name for the header.
  const { class: cls, students } = await listMyClassStudents(classId);

  return (
    <div className="space-y-4">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/classes">
          <ArrowLeft className="size-4" />
          My classes
        </Link>
      </Button>

      <div>
        <h2 className="text-lg font-semibold">{cls.name}</h2>
        <p className="text-muted-foreground text-sm">
          {students.length} {students.length === 1 ? "student" : "students"}
        </p>
      </div>

      <div
        role="tablist"
        className="bg-muted text-muted-foreground inline-flex items-center gap-1 rounded-lg p-1"
      >
        {TEACHER_TABS.map((t) => {
          const active = t.key === tab;
          return (
            <Link
              key={t.key}
              role="tab"
              aria-selected={active}
              href={`/classes?classId=${encodeURIComponent(classId)}&tab=${t.key}`}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                active
                  ? "bg-background text-foreground shadow-sm"
                  : "hover:text-foreground",
              )}
            >
              {t.label}
            </Link>
          );
        })}
      </div>

      {tab === "info" ? (
        <Card>
          <CardContent className="pt-6">
            <StudentRosterList students={students} />
          </CardContent>
        </Card>
      ) : tab === "attendance" ? (
        <ClassAttendanceTab classId={classId} date={date} month={month} />
      ) : (
        <ClassFeeTab classId={classId} />
      )}
    </div>
  );
}

/**
 * The functional attendance tab for a teacher: mark the roster for a chosen
 * date, and below it a monthly analysis (per-student rate + class average).
 * The date and month flow through the URL so both survive a refresh; marking
 * itself posts the shared `saveAttendanceAction` (TEACHER-allowed) and the
 * server re-renders in place.
 */
async function ClassAttendanceTab({
  classId,
  date,
  month,
}: {
  classId: string;
  date?: string;
  month?: string;
}) {
  const day = normalizeDate(date);
  const period = normalizeMonth(month);

  const [sheet, overview] = await Promise.all([
    getClassAttendanceForDate({ classId, sectionId: null, date: new Date(day) }),
    getClassAttendanceMonth({ classId, month: period }),
  ]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Take attendance</CardTitle>
          <CardDescription>Mark the class for a day, then save.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Server-rendered date picker: preserves the class + tab. */}
          <form method="get" action="/classes" className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="classId" value={classId} />
            <input type="hidden" name="tab" value="attendance" />
            <input type="hidden" name="month" value={period} />
            <div className="space-y-1">
              <label htmlFor="att-date" className="text-muted-foreground text-xs font-medium">
                Date
              </label>
              <Input id="att-date" type="date" name="date" defaultValue={day} className="w-44" />
            </div>
            <Button type="submit" variant="outline" size="sm">
              Load
            </Button>
          </form>

          {sheet.roster.length === 0 ? (
            <p className="text-muted-foreground text-sm">No active students in this class.</p>
          ) : (
            <MarkAttendanceForm
              classId={classId}
              sectionId=""
              date={day}
              className={sheet.class.name}
              roster={sheet.roster}
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base">Monthly attendance</CardTitle>
              <CardDescription>
                {monthLabel(period)}
                {overview.classAverage != null
                  ? ` - class average ${overview.classAverage}%`
                  : " - nothing marked yet"}
              </CardDescription>
            </div>
            <MonthStepper classId={classId} day={day} month={period} />
          </div>
        </CardHeader>
        <CardContent>
          {overview.rows.length === 0 ? (
            <p className="text-muted-foreground text-sm">No active students in this class.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-muted-foreground border-b text-left text-xs">
                    <th className="py-2 pr-3 font-medium">Student</th>
                    <th className="w-1/2 py-2 pr-3 font-medium">This month</th>
                    <th className="py-2 font-medium">Flag</th>
                  </tr>
                </thead>
                <tbody>
                  {overview.rows.map((r) => {
                    const pct = r.rate ?? 0;
                    const belowAverage =
                      r.rate != null &&
                      overview.classAverage != null &&
                      r.rate < overview.classAverage;
                    return (
                      <tr key={r.studentId} className="border-b last:border-0">
                        <td className="py-2 pr-3">
                          <span className="font-medium">{r.name}</span>
                          {r.rollNumber ? (
                            <span className="text-muted-foreground ml-2">#{r.rollNumber}</span>
                          ) : null}
                        </td>
                        <td className="py-2 pr-3">
                          <div className="flex items-center gap-2">
                            <div
                              className="bg-muted h-2 flex-1 overflow-hidden rounded-full"
                              role="progressbar"
                              aria-valuenow={pct}
                              aria-valuemin={0}
                              aria-valuemax={100}
                            >
                              <div
                                className={cn(
                                  "h-full rounded-full",
                                  pct >= 75
                                    ? "bg-green-500"
                                    : pct >= 40
                                      ? "bg-amber-500"
                                      : "bg-red-500",
                                )}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="text-muted-foreground w-24 shrink-0 text-right text-xs">
                              {r.total > 0 ? `${pct}% (${r.present}/${r.total})` : "—"}
                            </span>
                          </div>
                        </td>
                        <td className="py-2">
                          {r.rate != null && r.rate < 75 ? (
                            <Badge
                              variant="outline"
                              className="border-transparent bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400"
                            >
                              Low
                            </Badge>
                          ) : belowAverage ? (
                            <Badge variant="secondary">Below avg</Badge>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/** Prev/next month links for the monthly analysis, preserving class + date. */
function MonthStepper({ classId, day, month }: { classId: string; day: string; month: string }) {
  const base = `/classes?classId=${encodeURIComponent(classId)}&tab=attendance&date=${day}`;
  const atCurrent = month >= currentMonth();
  return (
    <div className="flex items-center gap-2">
      <Button asChild variant="outline" size="icon" aria-label="Previous month">
        <Link href={`${base}&month=${shiftMonth(month, -1)}`}>
          <ChevronLeft className="size-4" />
        </Link>
      </Button>
      <span className="text-muted-foreground w-28 text-center text-xs">{monthLabel(month)}</span>
      {atCurrent ? (
        <Button variant="outline" size="icon" aria-label="Next month" disabled>
          <ChevronRight className="size-4" />
        </Button>
      ) : (
        <Button asChild variant="outline" size="icon" aria-label="Next month">
          <Link href={`${base}&month=${shiftMonth(month, 1)}`}>
            <ChevronRight className="size-4" />
          </Link>
        </Button>
      )}
    </div>
  );
}

/** The class's fee invoices (read-only), grouped newest period first. */
async function ClassFeeTab({ classId }: { classId: string }) {
  const invoices = await listMyClassInvoices(classId);

  return (
    <Card>
      <CardContent className="pt-6">
        {invoices.length === 0 ? (
          <p className="text-muted-foreground text-sm">No invoices for this class yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-muted-foreground border-b text-left text-xs">
                  <th className="py-2 pr-3 font-medium">Student</th>
                  <th className="py-2 pr-3 font-medium">Period</th>
                  <th className="py-2 pr-3 text-right font-medium">Total</th>
                  <th className="py-2 pr-3 text-right font-medium">Paid</th>
                  <th className="py-2 pr-3 text-right font-medium">Balance</th>
                  <th className="py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id} className="border-b last:border-0">
                    <td className="py-2 pr-3">
                      {inv.studentName}
                      {inv.rollNumber ? (
                        <span className="text-muted-foreground ml-2">#{inv.rollNumber}</span>
                      ) : null}
                    </td>
                    <td className="py-2 pr-3">{inv.period}</td>
                    <td className="py-2 pr-3 text-right">{formatPKR(inv.total)}</td>
                    <td className="py-2 pr-3 text-right">{formatPKR(inv.paidAmount)}</td>
                    <td className="py-2 pr-3 text-right">{formatPKR(inv.balance)}</td>
                    <td className="py-2">
                      <InvoiceStatusBadge status={inv.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
