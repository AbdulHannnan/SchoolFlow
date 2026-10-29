import { Suspense } from "react";
import Link from "next/link";
import { forbidden } from "next/navigation";
import type { Metadata } from "next";

import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { verifySession } from "@/server/auth/dal";
import { listClassesWithSections } from "@/server/academics/classes";
import { listMarkableClasses } from "@/server/academics/attendance";
import { listChildrenLedgerSummaries, listClassFeeSummaries } from "@/server/fees/invoices";
import { listCategorySummaries } from "@/server/fees/category-report";
import { currentMonth, monthLabel } from "@/lib/attendance";
import { formatPKR } from "@/lib/money";

export const metadata: Metadata = {
  title: "Fees - School Management",
};

type SearchParams = Promise<{ classId?: string; period?: string }>;

export default function FeesPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <AppShell title="Fees">
      <Suspense fallback={<div className="bg-muted h-64 animate-pulse rounded-xl" />}>
        <FeesContent searchParams={searchParams} />
      </Suspense>
    </AppShell>
  );
}

async function FeesContent({ searchParams }: { searchParams: SearchParams }) {
  const user = await verifySession();
  if (user.role === "PARENT") return <ParentFees />;
  if (user.role === "TEACHER") return <TeacherFees searchParams={searchParams} />;
  if (user.role !== "HEAD") forbidden();
  return <FeeHeadOverview searchParams={searchParams} />;
}

/**
 * TEACHER: read-only fee status for the students of the classes they teach.
 * Teachers see only their assigned classes (not the school-wide figures), pick
 * one, and see each student's billed / paid / outstanding balance.
 */
async function TeacherFees({ searchParams }: { searchParams: SearchParams }) {
  const classes = await listMarkableClasses();

  if (classes.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        You have no classes yet. A head can add classes and assign you to one.
      </p>
    );
  }

  const sp = await searchParams;
  const selected = classes.find((c) => c.id === sp.classId) ?? classes[0];
  const summaries = await listClassFeeSummaries(selected.id);

  const totals = summaries.reduce(
    (acc, s) => ({
      billed: acc.billed + Number(s.billed),
      paid: acc.paid + Number(s.paid),
      balance: acc.balance + Number(s.balance),
    }),
    { billed: 0, paid: 0, balance: 0 },
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="pt-6">
          <form method="get" className="flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <label htmlFor="classId" className="text-muted-foreground text-xs">
                Class
              </label>
              <select
                id="classId"
                name="classId"
                defaultValue={selected.id}
                className="border-input dark:bg-input/30 h-9 rounded-md border bg-transparent px-2 text-sm"
              >
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <Button type="submit" variant="outline" size="sm">
              Open
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {selected.name}
            <span className="text-muted-foreground ml-2 text-sm font-normal">fee status</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <SummaryStat label="Billed" value={totals.billed} />
            <SummaryStat label="Paid" value={totals.paid} />
            <SummaryStat label="Outstanding" value={totals.balance} danger />
          </div>
        </CardContent>
      </Card>

      {summaries.length === 0 ? (
        <p className="text-muted-foreground text-sm">No active students in this class.</p>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground text-xs">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Roll</th>
                <th className="px-3 py-2 text-left font-medium">Student</th>
                <th className="px-3 py-2 text-right font-medium">Billed</th>
                <th className="px-3 py-2 text-right font-medium">Paid</th>
                <th className="px-3 py-2 text-right font-medium">Outstanding</th>
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {summaries.map((s) => (
                <tr key={s.student.id}>
                  <td className="text-muted-foreground px-3 py-2">{s.student.rollNumber ?? "—"}</td>
                  <td className="px-3 py-2">
                    {s.student.name}
                    {s.student.sectionName ? (
                      <span className="text-muted-foreground ml-2 text-xs">
                        {s.student.sectionName}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 text-right">{formatPKR(s.billed)}</td>
                  <td className="px-3 py-2 text-right">{formatPKR(s.paid)}</td>
                  <td
                    className={`px-3 py-2 text-right ${
                      Number(s.balance) > 0 ? "text-destructive" : "text-muted-foreground"
                    }`}
                  >
                    {Number(s.balance) > 0 ? formatPKR(s.balance) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/**
 * Resolve the `period` query param: absent -> current month (a sensible default
 * so the boxes show live figures), an empty string -> all months, a valid
 * "YYYY-MM" -> that month, anything else -> all months.
 */
function resolvePeriod(raw: string | undefined): string | null {
  if (raw === undefined) return currentMonth();
  return /^\d{4}-\d{2}$/.test(raw) ? raw : null;
}

/** A query string that carries the active filter onward to a category page. */
function filterQuery(period: string | null, classId: string | null): string {
  const p = new URLSearchParams();
  p.set("period", period ?? ""); // always explicit, so "all months" is preserved
  if (classId) p.set("classId", classId);
  return `?${p.toString()}`;
}

async function FeeHeadOverview({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const classes = await listClassesWithSections();
  const classId = classes.some((c) => c.id === sp.classId) ? sp.classId! : null;
  const period = resolvePeriod(sp.period);

  const summaries = await listCategorySummaries({ period, classId });

  const totals = summaries.reduce(
    (acc, s) => ({
      billed: acc.billed + Number(s.billed),
      collected: acc.collected + Number(s.collected),
      outstanding: acc.outstanding + Number(s.outstanding),
    }),
    { billed: 0, collected: 0, outstanding: 0 },
  );

  const query = filterQuery(period, classId);
  const scope = period ? monthLabel(period) : "all months";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-end gap-2">
        <Button asChild variant="outline" size="sm">
          <Link href="/fees/structure">Manage fees</Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link href="/fees/invoices">Invoices</Link>
        </Button>
      </div>

      <FeeFilterCard classes={classes} period={period} classId={classId} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Totals
            <span className="text-muted-foreground ml-2 text-sm font-normal">{scope}</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <SummaryStat label="Billed" value={totals.billed} />
            <SummaryStat label="Collected" value={totals.collected} />
            <SummaryStat label="Outstanding" value={totals.outstanding} danger />
          </div>
        </CardContent>
      </Card>

      {summaries.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No fee categories yet.{" "}
          <Link href="/fees/structure" className="underline">
            Add one
          </Link>{" "}
          (e.g. Admission, Tuition, Fines) to organise fees.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {summaries.map((c) => (
            <Link
              key={c.id}
              href={`/fees/category/${c.id}${query}`}
              className="focus-visible:ring-ring rounded-xl focus-visible:ring-2 focus-visible:outline-none"
            >
              <Card className="hover:border-primary/50 hover:bg-accent/40 h-full transition-colors">
                <CardHeader>
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-base">{c.name}</CardTitle>
                    <span className="text-muted-foreground text-xs">
                      {c.studentCount} {c.studentCount === 1 ? "student" : "students"}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Billed</span>
                    <span className="font-medium">{formatPKR(c.billed)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Collected</span>
                    <span className="font-medium">{formatPKR(c.collected)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Outstanding</span>
                    <span
                      className={`font-medium ${Number(c.outstanding) > 0 ? "text-destructive" : ""}`}
                    >
                      {formatPKR(c.outstanding)}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function SummaryStat({
  label,
  value,
  danger,
}: {
  label: string;
  value: number;
  danger?: boolean;
}) {
  return (
    <div>
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className={`font-medium ${danger && value > 0 ? "text-destructive" : ""}`}>
        {formatPKR(value)}
      </p>
    </div>
  );
}

/** Plain GET form: filters via the URL, no client JS. Shared shape with the category page. */
function FeeFilterCard({
  classes,
  period,
  classId,
}: {
  classes: { id: string; name: string }[];
  period: string | null;
  classId: string | null;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <form method="get" className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <label htmlFor="period" className="text-muted-foreground text-xs">
              Billing month
            </label>
            <input
              id="period"
              type="month"
              name="period"
              defaultValue={period ?? ""}
              className="border-input dark:bg-input/30 h-9 rounded-md border bg-transparent px-2 text-sm"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="classId" className="text-muted-foreground text-xs">
              Class
            </label>
            <select
              id="classId"
              name="classId"
              defaultValue={classId ?? ""}
              className="border-input dark:bg-input/30 h-9 rounded-md border bg-transparent px-2 text-sm"
            >
              <option value="">All classes</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <Button type="submit" variant="outline" size="sm">
            Filter
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

async function ParentFees() {
  const children = await listChildrenLedgerSummaries();

  if (children.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        No children are linked to your account yet. Please contact the school.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {children.map((c) => (
        <Card key={c.student.id}>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-base">
                <Link href={`/fees/students/${c.student.id}`} className="hover:underline">
                  {c.student.name}
                </Link>
                <span className="text-muted-foreground ml-2 text-sm font-normal">
                  {c.student.className}
                  {c.student.sectionName ? ` - ${c.student.sectionName}` : ""}
                </span>
              </CardTitle>
              <span className="text-sm font-medium">
                Balance{" "}
                <span className={Number(c.balance) > 0 ? "text-destructive" : ""}>
                  {formatPKR(c.balance)}
                </span>
              </span>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm">
              {c.invoiceCount} {c.invoiceCount === 1 ? "invoice" : "invoices"} · billed{" "}
              {formatPKR(c.billed)} · paid {formatPKR(c.paid)}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
