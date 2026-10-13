import { Suspense } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { forbidden } from "next/navigation";
import type { Metadata } from "next";

import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MonthNav } from "@/components/academics/month-nav";
import { cn } from "@/lib/utils";
import { verifySession } from "@/server/auth/dal";
import { getStaffAttendanceOverview } from "@/server/academics/staff-attendance";
import { monthLabel, normalizeMonth, presentRate } from "@/lib/attendance";

export const metadata: Metadata = {
  title: "Staff attendance summary - School Management",
};

type SearchParams = Promise<{ month?: string }>;

export default function StaffAttendanceSummaryPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  return (
    <AppShell title="Staff attendance">
      <Suspense fallback={<div className="bg-muted h-64 animate-pulse rounded-xl" />}>
        <StaffAttendanceSummaryContent searchParams={searchParams} />
      </Suspense>
    </AppShell>
  );
}

async function StaffAttendanceSummaryContent({ searchParams }: { searchParams: SearchParams }) {
  const user = await verifySession();
  if (user.role !== "HEAD") {
    forbidden();
  }

  const month = normalizeMonth((await searchParams).month);
  const { rows } = await getStaffAttendanceOverview({ month });

  return (
    <div className="space-y-4">
      <Link
        href="/staff-attendance"
        className="text-muted-foreground hover:text-foreground -ml-1 inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" />
        Mark attendance
      </Link>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="text-base">
              Staff attendance
              <span className="text-muted-foreground ml-2 text-sm font-normal">
                {monthLabel(month)}
              </span>
            </CardTitle>
            <MonthNav month={month} />
          </div>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="text-muted-foreground text-sm">No teaching staff yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-muted-foreground border-b text-left">
                    <th className="py-2 pr-3 font-medium">Staff</th>
                    <th className="w-1/2 py-2 font-medium">This month</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const pct = presentRate(r.present, r.total);
                    return (
                      <tr key={r.staffId} className="border-b last:border-0">
                        <td className="py-2 pr-3">
                          <Link
                            href={`/staff-attendance/${r.staffId}?month=${month}`}
                            className="font-medium hover:underline"
                          >
                            {r.name}
                          </Link>
                          {r.mainSubject ? (
                            <span className="text-muted-foreground ml-2 text-xs">
                              {r.mainSubject}
                            </span>
                          ) : null}
                        </td>
                        <td className="py-2">
                          <div className="flex items-center gap-2">
                            <div
                              className="bg-muted h-2 flex-1 overflow-hidden rounded-full"
                              role="progressbar"
                              aria-valuenow={pct ?? 0}
                              aria-valuemin={0}
                              aria-valuemax={100}
                            >
                              <div
                                className={cn(
                                  "h-full rounded-full",
                                  (pct ?? 0) >= 75
                                    ? "bg-green-500"
                                    : (pct ?? 0) >= 40
                                      ? "bg-amber-500"
                                      : "bg-red-500",
                                )}
                                style={{ width: `${pct ?? 0}%` }}
                              />
                            </div>
                            <span className="text-muted-foreground w-24 shrink-0 text-right text-xs">
                              {pct !== null ? `${pct}% (${r.present}/${r.total})` : "—"}
                            </span>
                          </div>
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
