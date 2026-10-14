import Link from "next/link";
import { Users, Wallet, NotebookPen, Bell, CalendarCheck, ArrowRight } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyRow, StatTile } from "@/components/dashboard/primitives";
import { getParentDashboard, type ParentChildRow } from "@/server/dashboard-parent";
import { formatDay, monthLabel } from "@/lib/attendance";
import { formatPKR } from "@/lib/money";

/** The signed-in parent's overview of their children (Module 9.3). */
export async function ParentDashboard() {
  const { month, children, totals } = await getParentDashboard();

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile icon={Users} label="Children" value={totals.children} href="/progress" />
        <StatTile
          icon={Wallet}
          label="Outstanding fees"
          value={formatPKR(totals.outstanding)}
          href="/fees"
        />
        <StatTile
          icon={NotebookPen}
          label="Homework this week"
          value={totals.homeworkThisWeek}
          href="/homework"
        />
        <StatTile icon={Bell} label="Unread alerts" value={totals.unread} href="/notifications" />
      </div>

      {children.length === 0 ? (
        <EmptyRow>
          No children are linked to your account yet. Please contact the school office.
        </EmptyRow>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {children.map((child) => (
            <ChildCard key={child.student.id} child={child} month={month} />
          ))}
        </div>
      )}
    </div>
  );
}

function ChildCard({ child, month }: { child: ParentChildRow; month: string }) {
  const { student, attendance, fees, latestHomework } = child;
  const classLine = [student.className, student.sectionName].filter(Boolean).join(" - ");

  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">{student.name}</CardTitle>
            {classLine ? <p className="text-muted-foreground text-xs">{classLine}</p> : null}
          </div>
          <Link
            href={`/progress/${student.id}`}
            className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-sm"
          >
            Progress
            <ArrowRight className="size-3.5" />
          </Link>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <StatRow
          icon={CalendarCheck}
          label={`Attendance (${monthLabel(month)})`}
          href={`/attendance/${student.id}`}
          value={
            attendance.presentRate == null ? "Not marked yet" : `${attendance.presentRate}% present`
          }
          sub={attendance.markedDays > 0 ? `${attendance.markedDays} days marked` : undefined}
        />
        <StatRow
          icon={Wallet}
          label="Fees"
          href={`/fees/students/${student.id}`}
          value={fees.balance > 0 ? formatPKR(fees.balance) : "Cleared"}
          sub={
            fees.invoiceCount > 0
              ? `${fees.invoiceCount} invoice${fees.invoiceCount === 1 ? "" : "s"}`
              : "No invoices"
          }
          emphasize={fees.balance > 0}
        />
        <StatRow
          icon={NotebookPen}
          label="Latest homework"
          href="/homework"
          value={latestHomework ? latestHomework.title : "No recent homework"}
          sub={
            latestHomework
              ? [latestHomework.subject, formatDay(latestHomework.date)].filter(Boolean).join(" · ")
              : undefined
          }
        />
      </CardContent>
    </Card>
  );
}

function StatRow({
  icon: Icon,
  label,
  value,
  sub,
  href,
  emphasize,
}: {
  icon: typeof CalendarCheck;
  label: string;
  value: string;
  sub?: string;
  href: string;
  emphasize?: boolean;
}) {
  return (
    <Link
      href={href}
      className="hover:bg-accent/40 -mx-2 flex items-start gap-3 rounded-md px-2 py-1.5 transition-colors"
    >
      <Icon className="text-muted-foreground mt-0.5 size-4 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-muted-foreground text-xs">{label}</p>
        <p
          className={`truncate text-sm ${emphasize ? "text-foreground font-semibold" : "font-medium"}`}
        >
          {value}
        </p>
      </div>
      {sub ? <span className="text-muted-foreground shrink-0 text-xs">{sub}</span> : null}
    </Link>
  );
}
