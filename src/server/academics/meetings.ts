import "server-only";

import { requireSchool, withCurrentTenant } from "@/server/auth/dal";
import { withTenant } from "@/server/db/tenant";
import { dispatch } from "@/server/notifications/dispatch";
import { formatMeetingWhen } from "@/lib/meetings";

/**
 * Staff meetings (Module 8.3). A HEAD schedules a meeting and invites teachers;
 * creating it fans a MEETING notification out to those teachers through the
 * Module 4 engine. Reads and writes run inside the tenant RLS context; role
 * enforcement (HEAD creates/deletes) lives in the route actions.
 */

export type CreateMeetingInput = {
  title: string;
  agenda: string | null;
  location: string | null;
  scheduledAt: Date;
  teacherIds: string[];
};

/**
 * Schedule a meeting and invite the given teachers, then notify each invitee
 * in-app. FK targets are re-checked in-tenant (RLS doesn't guard them): only
 * ids that resolve to a TEACHER in this school are invited, deduped. The
 * dispatch runs after the transaction commits, so a rolled-back create never
 * notifies anyone. Returns the meeting id and how many teachers were invited.
 */
export async function createMeeting(input: CreateMeetingInput) {
  const { user, schoolId } = await requireSchool();

  const result = await withTenant(schoolId, async (tx) => {
    const wanted = [...new Set(input.teacherIds)];
    const teachers =
      wanted.length === 0
        ? []
        : await tx.user.findMany({
            where: { id: { in: wanted }, role: "TEACHER" },
            select: { id: true },
          });
    const teacherIds = teachers.map((t) => t.id);

    const meeting = await tx.meeting.create({
      data: {
        schoolId,
        title: input.title,
        agenda: input.agenda,
        location: input.location,
        scheduledAt: input.scheduledAt,
        createdById: user.id,
      },
      select: { id: true },
    });

    // Invitees are created with explicit scalars (not a nested write): the
    // invitee's schoolId is shared by its school/meeting/teacher relations, so
    // a nested `invitees.create` can't set it. createMany with plain columns can.
    if (teacherIds.length > 0) {
      await tx.meetingInvitee.createMany({
        data: teacherIds.map((teacherId) => ({ schoolId, meetingId: meeting.id, teacherId })),
      });
    }

    return { meetingId: meeting.id, teacherIds };
  });

  if (result.teacherIds.length > 0) {
    await dispatch({
      type: "STAFF_MEETING",
      schoolId,
      recipientIds: result.teacherIds,
      meetingId: result.meetingId,
      meetingTitle: input.title,
      when: formatMeetingWhen(input.scheduledAt),
      location: input.location,
      channels: ["in-app"],
    });
  }

  return { id: result.meetingId, invited: result.teacherIds.length };
}

export type MeetingListItem = {
  id: string;
  title: string;
  agenda: string | null;
  location: string | null;
  scheduledAt: Date;
  inviteeCount: number;
  createdBy: { name: string } | null;
};

/** Every meeting for the school (HEAD view), soonest-scheduled last-created first. */
export async function listMeetings(): Promise<MeetingListItem[]> {
  const meetings = await withCurrentTenant((tx) =>
    tx.meeting.findMany({
      orderBy: { scheduledAt: "desc" },
      select: {
        id: true,
        title: true,
        agenda: true,
        location: true,
        scheduledAt: true,
        createdBy: { select: { name: true } },
        _count: { select: { invitees: true } },
      },
    }),
  );
  return meetings.map((m) => ({
    id: m.id,
    title: m.title,
    agenda: m.agenda,
    location: m.location,
    scheduledAt: m.scheduledAt,
    inviteeCount: m._count.invitees,
    createdBy: m.createdBy,
  }));
}

export type MyMeetingItem = {
  id: string;
  title: string;
  agenda: string | null;
  location: string | null;
  scheduledAt: Date;
  createdBy: { name: string } | null;
};

/** Meetings the signed-in teacher is invited to, newest scheduled first. */
export async function listMyMeetings(): Promise<MyMeetingItem[]> {
  const { user, schoolId } = await requireSchool();
  return withTenant(schoolId, (tx) =>
    tx.meeting.findMany({
      where: { invitees: { some: { teacherId: user.id } } },
      orderBy: { scheduledAt: "desc" },
      select: {
        id: true,
        title: true,
        agenda: true,
        location: true,
        scheduledAt: true,
        createdBy: { select: { name: true } },
      },
    }),
  );
}

/** Delete a meeting (HEAD). Its invitees cascade. RLS pins it to the school. */
export async function deleteMeeting(id: string): Promise<void> {
  const { schoolId } = await requireSchool();
  await withTenant(schoolId, (tx) => tx.meeting.deleteMany({ where: { id } }));
}
