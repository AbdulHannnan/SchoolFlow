import Link from "next/link";
import { Layers, CalendarCheck, CalendarRange, CalendarClock, CheckCircle2 } from "lucide-react";
import type { PlannerStatus } from "@prisma/client";

import { Badge } from "@/components/ui/badge";
import { EmptyRow, SectionCard, StatTile } from "@/components/dashboard/primitives";
import { getTeacherDashboard } from "@/server/dashboard-teacher";
import { formatDay } from "@/lib/attendance";
import { formatMeetingWhen } from "@/lib/meetings";

/** The signed-in teacher's own overview (Module 9.2). */
export async function TeacherDashboard() {
  const { classes, attendance, planner, meetings } = await getTeacherDashboard();

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile icon={Layers} label="My classes" value={classes.length} href="/attendance" />
        <StatTile
          icon={CalendarCheck}
          label="Marked today"
          value={`${attendance.marked}/${attendance.total}`}
          href="/attendance"
        />
        <StatTile
          icon={CalendarRange}
          label="Plans this week"
          value={planner.weekTotal}
          href="/planner"
        />
        <StatTile
          icon={CalendarClock}
          label="Upcoming meetings"
          value={meetings.upcomingCount}
          href="/meetings"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard
          icon={CalendarCheck}
          title="Mark attendance today"
          href="/attendance"
          hint={classes.length > 0 ? `${attendance.marked} of ${attendance.total} done` : undefined}
        >
          {classes.length === 0 ? (
            <EmptyRow>No classes assigned to you yet. A head can assign you to one.</EmptyRow>
          ) : (
            <ul className="divide-border divide-y text-sm">
              {classes.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-3 py-2 first:pt-0">
                  <span className="truncate font-medium">{c.name}</span>
                  {c.markedToday ? (
                    <Badge variant="secondary" className="gap-1">
                      <CheckCircle2 className="size-3" />
                      Marked
                    </Badge>
                  ) : (
                    <Link
                      href="/attendance"
                      className="text-primary text-xs font-medium hover:underline"
                    >
                      Mark now
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard
          icon={CalendarRange}
          title="This week's planner"
          href="/planner"
          hint={
            planner.weekTotal > 0
              ? `${planner.pending} pending, ${planner.completed} done`
              : undefined
          }
        >
          {planner.recent.length === 0 ? (
            <EmptyRow>No lesson plans this week. Add one from the planner.</EmptyRow>
          ) : (
            <ul className="divide-border divide-y text-sm">
              {planner.recent.map((p) => (
                <li key={p.id} className="flex items-start justify-between gap-3 py-2 first:pt-0">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{p.topic}</p>
                    <p className="text-muted-foreground truncate text-xs">
                      {p.class.name} · {p.subject.name} · {formatDay(p.date)}
                    </p>
                  </div>
                  <PlannerStatusBadge status={p.status} />
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard
          icon={CalendarClock}
          title="Upcoming meetings"
          href="/meetings"
          hint={meetings.upcomingCount > 0 ? `${meetings.upcomingCount} upcoming` : undefined}
        >
          {meetings.upcoming.length === 0 ? (
            <EmptyRow>No upcoming meetings.</EmptyRow>
          ) : (
            <ul className="divide-border divide-y text-sm">
              {meetings.upcoming.map((m) => (
                <li key={m.id} className="space-y-0.5 py-2 first:pt-0">
                  <p className="truncate font-medium">{m.title}</p>
                  <p className="text-muted-foreground text-xs">
                    {formatMeetingWhen(m.scheduledAt)}
                    {m.location ? ` · ${m.location}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>
    </div>
  );
}

function PlannerStatusBadge({ status }: { status: PlannerStatus }) {
  return status === "COMPLETED" ? (
    <Badge variant="secondary" className="shrink-0 gap-1">
      <CheckCircle2 className="size-3" />
      Done
    </Badge>
  ) : (
    <Badge variant="outline" className="shrink-0">
      Planned
    </Badge>
  );
}
