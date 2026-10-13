import { Suspense, type ReactNode } from "react";
import { forbidden } from "next/navigation";
import { CalendarClock, MapPin, Users } from "lucide-react";
import type { Metadata } from "next";

import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { addBoxClass } from "@/components/ui/add-box";
import { CreateMeetingForm } from "@/components/academics/create-meeting-form";
import { DeleteButton } from "@/components/academics/delete-button";
import { deleteMeetingAction } from "@/app/meetings/actions";
import { verifySession } from "@/server/auth/dal";
import { listTeachers } from "@/server/academics/teachers";
import {
  listMeetings,
  listMyMeetings,
  type MeetingListItem,
  type MyMeetingItem,
} from "@/server/academics/meetings";
import { formatMeetingWhen } from "@/lib/meetings";

export const metadata: Metadata = {
  title: "Meetings - School Management",
};

export default function MeetingsPage() {
  return (
    <AppShell title="Staff meetings">
      <Suspense fallback={<div className="bg-muted h-64 animate-pulse rounded-xl" />}>
        <MeetingsContent />
      </Suspense>
    </AppShell>
  );
}

async function MeetingsContent() {
  const user = await verifySession();
  if (user.role === "TEACHER") return <TeacherMeetings />;
  if (user.role !== "HEAD") forbidden();
  return <HeadMeetings />;
}

/** Tomorrow 09:00 (local) as a "YYYY-MM-DDTHH:mm" datetime-local default. */
function defaultMeetingWhen(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

async function HeadMeetings() {
  const [teachers, meetings] = await Promise.all([listTeachers(), listMeetings()]);
  const activeTeachers = teachers.filter((t) => t.isActive);

  return (
    <div className="space-y-6">
      <Card className={addBoxClass}>
        <CardHeader>
          <CardTitle className="text-base">Schedule a meeting</CardTitle>
        </CardHeader>
        <CardContent>
          <CreateMeetingForm
            teachers={activeTeachers.map((t) => ({ id: t.id, name: t.name }))}
            defaultWhen={defaultMeetingWhen()}
          />
        </CardContent>
      </Card>

      <section className="space-y-3">
        <h2 className="text-sm font-medium">Scheduled meetings</h2>
        {meetings.length === 0 ? (
          <p className="text-muted-foreground text-sm">No meetings scheduled yet.</p>
        ) : (
          <ul className="space-y-3">
            {meetings.map((m) => (
              <li key={m.id}>
                <MeetingCard
                  meeting={m}
                  footer={
                    <span className="text-muted-foreground inline-flex items-center gap-1 text-xs">
                      <Users className="size-3.5" />
                      {m.inviteeCount} invited
                      {m.createdBy ? ` · by ${m.createdBy.name}` : ""}
                    </span>
                  }
                  action={<DeleteButton action={deleteMeetingAction} id={m.id} label={m.title} />}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

async function TeacherMeetings() {
  const meetings = await listMyMeetings();

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-medium">Your meetings</h2>
      {meetings.length === 0 ? (
        <p className="text-muted-foreground text-sm">You have no meetings scheduled.</p>
      ) : (
        <ul className="space-y-3">
          {meetings.map((m) => (
            <li key={m.id}>
              <MeetingCard
                meeting={m}
                footer={
                  m.createdBy ? (
                    <span className="text-muted-foreground text-xs">
                      Scheduled by {m.createdBy.name}
                    </span>
                  ) : null
                }
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function MeetingCard({
  meeting,
  footer,
  action,
}: {
  meeting: MeetingListItem | MyMeetingItem;
  footer?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="space-y-1">
            <CardTitle className="text-base">{meeting.title}</CardTitle>
            <div className="text-muted-foreground flex flex-wrap items-center gap-3 text-xs">
              <span className="inline-flex items-center gap-1">
                <CalendarClock className="size-3.5" />
                {formatMeetingWhen(meeting.scheduledAt)}
              </span>
              {meeting.location ? (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="size-3.5" />
                  {meeting.location}
                </span>
              ) : null}
            </div>
          </div>
          {action ?? null}
        </div>
      </CardHeader>
      {meeting.agenda || footer ? (
        <CardContent className="space-y-2">
          {meeting.agenda ? <p className="text-sm whitespace-pre-wrap">{meeting.agenda}</p> : null}
          {footer}
        </CardContent>
      ) : null}
    </Card>
  );
}
