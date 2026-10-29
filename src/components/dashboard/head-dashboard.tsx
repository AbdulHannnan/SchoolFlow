import {
  GraduationCap,
  Users,
  Layers,
  Contact,
  CalendarCheck,
  UserCheck,
  Wallet,
  TriangleAlert,
} from "lucide-react";
import type { RedFlagType } from "@prisma/client";

import { Badge } from "@/components/ui/badge";
import { EmptyRow, SectionCard, StatTile } from "@/components/dashboard/primitives";
import { getHeadDashboard, type AttendanceBreakdown } from "@/server/dashboard-head";
import { presentRate, monthLabel, formatDay } from "@/lib/attendance";
import { formatPKR } from "@/lib/money";

const RED_FLAG_LABELS: Record<RedFlagType, string> = {
  ATTENDANCE_LOW: "Attendance",
  GRADES_LOW: "Grades",
  BEHAVIOR: "Behaviour",
};

/** The HEAD's school-wide overview (Module 9.1). */
export async function HeadDashboard() {
  const data = await getHeadDashboard();
  const { counts, attendanceToday, staffToday, fees, redFlags } = data;

  const studentRate = presentRate(
    attendanceToday.breakdown.PRESENT,
    attendanceToday.breakdown.total,
  );
  const staffRate = presentRate(staffToday.breakdown.PRESENT, staffToday.breakdown.total);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile icon={GraduationCap} label="Students" value={counts.students} href="/students" />
        <StatTile icon={Users} label="Teachers" value={counts.teachers} href="/teachers" />
        <StatTile icon={Layers} label="Classes" value={counts.classes} href="/classes" />
        <StatTile icon={Contact} label="Parents" value={counts.parents} href="/parents" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard
          icon={CalendarCheck}
          title="Attendance today"
          href="/attendance"
          hint={`${attendanceToday.classesMarked} of ${attendanceToday.totalClasses} classes marked`}
        >
          {attendanceToday.breakdown.total === 0 ? (
            <EmptyRow>No student attendance marked yet today.</EmptyRow>
          ) : (
            <div className="space-y-3">
              <RateHeadline
                rate={studentRate}
                caption={`${attendanceToday.breakdown.total} marked`}
              />
              <BreakdownPills breakdown={attendanceToday.breakdown} />
            </div>
          )}
        </SectionCard>

        <SectionCard
          icon={UserCheck}
          title="Staff attendance today"
          href="/staff-attendance"
          hint={`${staffToday.breakdown.total} of ${staffToday.totalStaff} staff marked`}
        >
          {staffToday.breakdown.total === 0 ? (
            <EmptyRow>No staff attendance marked yet today.</EmptyRow>
          ) : (
            <div className="space-y-3">
              <RateHeadline rate={staffRate} caption={`${staffToday.breakdown.total} marked`} />
              <BreakdownPills breakdown={staffToday.breakdown} />
            </div>
          )}
        </SectionCard>

        <SectionCard
          icon={Wallet}
          title={`Fees - ${monthLabel(fees.period)}`}
          href="/fees"
          hint={
            fees.pendingPayments > 0
              ? `${fees.pendingPayments} payment${fees.pendingPayments === 1 ? "" : "s"} to verify`
              : undefined
          }
        >
          <div className="space-y-3">
            <div className="flex flex-wrap items-baseline gap-x-2">
              <span className="text-2xl font-semibold tabular-nums">
                {formatPKR(fees.collectedThisMonth)}
              </span>
              <span className="text-muted-foreground text-sm">
                collected of {formatPKR(fees.billedThisMonth)} billed
              </span>
            </div>
            <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-sm">
              <span className="text-foreground font-medium tabular-nums">
                {formatPKR(fees.outstandingTotal)}
              </span>
              <span>
                outstanding across {fees.outstandingInvoices} invoice
                {fees.outstandingInvoices === 1 ? "" : "s"}
              </span>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          icon={TriangleAlert}
          title="Open red flags"
          href="/red-flags?status=OPEN"
          hint={`${redFlags.open} open`}
        >
          {redFlags.recent.length === 0 ? (
            <EmptyRow>No open red flags. Run a scan from the Red Flags page.</EmptyRow>
          ) : (
            <ul className="divide-border divide-y text-sm">
              {redFlags.recent.map((flag) => (
                <li
                  key={flag.id}
                  className="flex items-start justify-between gap-3 py-2 first:pt-0"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{flag.student.name}</p>
                    <p className="text-muted-foreground truncate text-xs">{flag.detail}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <Badge variant="destructive">{RED_FLAG_LABELS[flag.type]}</Badge>
                    <span className="text-muted-foreground text-xs">
                      {formatDay(flag.createdAt)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>
    </div>
  );
}

function RateHeadline({ rate, caption }: { rate: number | null; caption: string }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-2xl font-semibold tabular-nums">{rate == null ? "-" : `${rate}%`}</span>
      <span className="text-muted-foreground text-sm">present · {caption}</span>
    </div>
  );
}

function BreakdownPills({ breakdown }: { breakdown: AttendanceBreakdown }) {
  const items: { label: string; value: number }[] = [
    { label: "Present", value: breakdown.PRESENT },
    { label: "Absent", value: breakdown.ABSENT },
    { label: "Late", value: breakdown.LATE },
    { label: "Leave", value: breakdown.LEAVE },
  ];
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <span
          key={item.label}
          className="bg-muted text-muted-foreground inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs"
        >
          {item.label}
          <span className="text-foreground font-medium tabular-nums">{item.value}</span>
        </span>
      ))}
    </div>
  );
}
