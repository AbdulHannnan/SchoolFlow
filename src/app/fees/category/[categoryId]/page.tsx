import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";

import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InvoiceStatusBadge } from "@/components/fees/invoice-status-badge";
import { requireRole } from "@/server/auth/dal";
import { listClassesWithSections } from "@/server/academics/classes";
import { getCategoryBreakdown } from "@/server/fees/category-report";
import { currentMonth, formatDay, monthLabel } from "@/lib/attendance";
import { formatPKR } from "@/lib/money";

export const metadata: Metadata = {
  title: "Fee category - School Management",
};

// Dynamic route: the shell's `usePathname()` has no statically-known path for a
// `[categoryId]` segment, so render on demand rather than prerendering a static
// shell. See the Cache Components notes.
export const instant = false;

type Params = Promise<{ categoryId: string }>;
type SearchParams = Promise<{ classId?: string; period?: string }>;

export default function FeeCategoryPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  return (
    <AppShell title="Fee category">
      <Suspense fallback={<div className="bg-muted h-64 animate-pulse rounded-xl" />}>
        <CategoryContent params={params} searchParams={searchParams} />
      </Suspense>
    </AppShell>
  );
}

function resolvePeriod(raw: string | undefined): string | null {
  if (raw === undefined) return currentMonth();
  return /^\d{4}-\d{2}$/.test(raw) ? raw : null;
}

function backQuery(period: string | null, classId: string | null): string {
  const p = new URLSearchParams();
  p.set("period", period ?? "");
  if (classId) p.set("classId", classId);
  return `?${p.toString()}`;
}

async function CategoryContent({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  await requireRole("HEAD");
  const { categoryId } = await params;
  const sp = await searchParams;

  const classes = await listClassesWithSections();
  const classId = classes.some((c) => c.id === sp.classId) ? sp.classId! : null;
  const period = resolvePeriod(sp.period);

  let data: Awaited<ReturnType<typeof getCategoryBreakdown>> | null = null;
  let error: string | null = null;
  try {
    data = await getCategoryBreakdown(categoryId, { period, classId });
  } catch (e) {
    error = e instanceof Error ? e.message : "Unable to load this category.";
  }

  if (error || !data) {
    return (
      <div className="space-y-4">
        <Button asChild variant="outline" size="sm">
          <Link href={`/fees${backQuery(period, classId)}`}>Back to fees</Link>
        </Button>
        <p className="text-muted-foreground text-sm">{error ?? "Category not available."}</p>
      </div>
    );
  }

  const { category, rows, summary } = data;
  const scope = period ? monthLabel(period) : "all months";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">
          {category.name}
          <span className="text-muted-foreground ml-2 text-sm font-normal">{scope}</span>
        </h2>
        <Button asChild variant="outline" size="sm">
          <Link href={`/fees${backQuery(period, classId)}`}>Back to fees</Link>
        </Button>
      </div>

      {/* Plain GET form: filters via the URL, no client JS. */}
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

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Totals
            <span className="text-muted-foreground ml-2 text-sm font-normal">
              {summary.studentCount} {summary.studentCount === 1 ? "student" : "students"}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground text-xs">Billed</p>
              <p className="font-medium">{formatPKR(summary.billed)}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Collected</p>
              <p className="font-medium">{formatPKR(summary.collected)}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Outstanding</p>
              <p
                className={`font-medium ${Number(summary.outstanding) > 0 ? "text-destructive" : ""}`}
              >
                {formatPKR(summary.outstanding)}
              </p>
            </div>
          </div>
          <p className="text-muted-foreground text-xs">
            Collected and outstanding allocate each invoice&apos;s payments across its charges in
            proportion to amount.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {rows.length} {rows.length === 1 ? "charge" : "charges"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No charges in this category for the current filter.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-muted-foreground border-border border-b text-left text-xs">
                    <th className="py-2 pr-3 font-medium">Student</th>
                    <th className="py-2 pr-3 font-medium">Class</th>
                    <th className="py-2 pr-3 font-medium">Month</th>
                    <th className="py-2 pr-3 text-right font-medium">Charged</th>
                    <th className="py-2 pr-3 text-right font-medium">Paid</th>
                    <th className="py-2 pr-3 text-right font-medium">Outstanding</th>
                    <th className="py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-border divide-y">
                  {rows.map((r) => (
                    <tr key={r.invoiceId}>
                      <td className="py-2 pr-3">
                        <Link
                          href={`/fees/students/${r.studentId}`}
                          className="font-medium hover:underline"
                        >
                          {r.studentName}
                        </Link>
                        {r.rollNumber ? (
                          <span className="text-muted-foreground ml-1 text-xs">
                            #{r.rollNumber}
                          </span>
                        ) : null}
                      </td>
                      <td className="text-muted-foreground py-2 pr-3">{r.className ?? "-"}</td>
                      <td className="text-muted-foreground py-2 pr-3">
                        {r.periodLabel}
                        {r.dueDate ? (
                          <span className="block text-xs">due {formatDay(r.dueDate)}</span>
                        ) : null}
                      </td>
                      <td className="py-2 pr-3 text-right">{formatPKR(r.charged)}</td>
                      <td className="py-2 pr-3 text-right">{formatPKR(r.paid)}</td>
                      <td
                        className={`py-2 pr-3 text-right ${Number(r.outstanding) > 0 ? "text-destructive" : ""}`}
                      >
                        {formatPKR(r.outstanding)}
                      </td>
                      <td className="py-2">
                        <InvoiceStatusBadge status={r.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
