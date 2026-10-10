import { Suspense } from "react";
import Link from "next/link";
import { forbidden } from "next/navigation";
import type { Metadata } from "next";
import type { RedFlagType } from "@prisma/client";

import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScanRedFlagsForm } from "@/components/academics/scan-red-flags-form";
import { reopenRedFlagAction, resolveRedFlagAction } from "@/app/red-flags/actions";
import { verifySession } from "@/server/auth/dal";
import { listMarkableClasses } from "@/server/academics/attendance";
import { listRedFlags, type RedFlagRow } from "@/server/academics/red-flags";
import { currentMonth, formatDay } from "@/lib/attendance";

export const metadata: Metadata = {
  title: "Red Flags - School Management",
};

const TYPE_LABELS: Record<RedFlagType, string> = {
  ATTENDANCE_LOW: "Attendance",
  GRADES_LOW: "Grades",
};

type SearchParams = Promise<{ status?: string }>;

export default function RedFlagsPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <AppShell title="Red Flags">
      <Suspense fallback={<div className="bg-muted h-64 animate-pulse rounded-xl" />}>
        <RedFlagsContent searchParams={searchParams} />
      </Suspense>
    </AppShell>
  );
}

async function RedFlagsContent({ searchParams }: { searchParams: SearchParams }) {
  const user = await verifySession();
  if (user.role !== "HEAD") forbidden();

  const sp = await searchParams;
  const filter = sp.status === "OPEN" || sp.status === "RESOLVED" ? sp.status : undefined;

  const [classes, flags] = await Promise.all([
    listMarkableClasses(),
    listRedFlags(filter ? { status: filter } : undefined),
  ]);

  const tabs: { label: string; href: string; active: boolean }[] = [
    { label: "All", href: "/red-flags", active: !filter },
    { label: "Open", href: "/red-flags?status=OPEN", active: filter === "OPEN" },
    { label: "Resolved", href: "/red-flags?status=RESOLVED", active: filter === "RESOLVED" },
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Run a scan</CardTitle>
        </CardHeader>
        <CardContent>
          <ScanRedFlagsForm
            classes={classes.map((c) => ({ id: c.id, name: c.name }))}
            defaultMonth={currentMonth()}
          />
          <p className="text-muted-foreground mt-3 text-xs">
            Flags a student with 4 or more absences in the chosen month, or 2+ failed subjects / an
            overall below 40% in a published exam. HEADs are notified of new flags.
          </p>
        </CardContent>
      </Card>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {tabs.map((t) => (
            <Button key={t.href} asChild size="sm" variant={t.active ? "default" : "outline"}>
              <Link href={t.href}>{t.label}</Link>
            </Button>
          ))}
        </div>

        {flags.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No red flags{filter ? ` that are ${filter.toLowerCase()}` : ""}. Run a scan to check.
          </p>
        ) : (
          <ul className="space-y-3">
            {flags.map((flag) => (
              <li key={flag.id}>
                <FlagCard flag={flag} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function FlagCard({ flag }: { flag: RedFlagRow }) {
  const resolved = flag.status === "RESOLVED";
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="space-y-1">
            <CardTitle className="text-base">
              {flag.student.name}
              <span className="text-muted-foreground ml-2 text-sm font-normal">
                {flag.student.class?.name ?? ""}
                {flag.student.section ? ` - ${flag.student.section.name}` : ""}
                {flag.student.rollNumber ? ` · Roll ${flag.student.rollNumber}` : ""}
              </span>
            </CardTitle>
            <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
              <Badge variant={resolved ? "secondary" : "destructive"}>
                {TYPE_LABELS[flag.type]}
              </Badge>
              <span>{flag.detail}</span>
              <span>· raised {formatDay(flag.createdAt)}</span>
              {resolved && flag.resolvedAt ? (
                <span>· resolved {formatDay(flag.resolvedAt)}</span>
              ) : null}
            </div>
          </div>
          {resolved ? (
            <form action={reopenRedFlagAction}>
              <input type="hidden" name="id" value={flag.id} />
              <Button type="submit" size="sm" variant="outline">
                Reopen
              </Button>
            </form>
          ) : (
            <form action={resolveRedFlagAction}>
              <input type="hidden" name="id" value={flag.id} />
              <Button type="submit" size="sm" variant="secondary">
                Resolve
              </Button>
            </form>
          )}
        </div>
      </CardHeader>
    </Card>
  );
}
