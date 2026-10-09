import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";

import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GenerateInvoicesForm, type InvoiceClass } from "@/components/fees/generate-invoices-form";
import { InvoiceStatusBadge } from "@/components/fees/invoice-status-badge";
import { rejectPaymentAction, verifyPaymentAction } from "@/app/fees/actions";
import { requireRole } from "@/server/auth/dal";
import { listClassesWithSections } from "@/server/academics/classes";
import { listInvoices } from "@/server/fees/invoices";
import { listPendingPayments } from "@/server/fees/payments";
import { currentMonth, formatDay } from "@/lib/attendance";
import { formatPKR } from "@/lib/money";

export const metadata: Metadata = {
  title: "Invoices - School Management",
};

type SearchParams = Promise<{ classId?: string; period?: string }>;

export default function InvoicesPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <AppShell title="Invoices">
      <Suspense fallback={<div className="bg-muted h-64 animate-pulse rounded-xl" />}>
        <InvoicesContent searchParams={searchParams} />
      </Suspense>
    </AppShell>
  );
}

async function InvoicesContent({ searchParams }: { searchParams: SearchParams }) {
  await requireRole("HEAD");
  const sp = await searchParams;

  const classes = await listClassesWithSections();
  const classId = classes.some((c) => c.id === sp.classId) ? sp.classId! : null;
  const period = sp.period && /^\d{4}-\d{2}$/.test(sp.period) ? sp.period : null;

  const [invoices, pending] = await Promise.all([
    listInvoices({ classId, period }),
    listPendingPayments(),
  ]);
  const classOptions: InvoiceClass[] = classes.map((c) => ({
    id: c.id,
    name: c.name,
    sections: c.sections,
  }));

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button asChild variant="outline" size="sm">
          <Link href="/fees">Fee structure</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Generate invoices</CardTitle>
        </CardHeader>
        <CardContent>
          {classes.length === 0 ? (
            <p className="text-muted-foreground text-sm">Add a class first.</p>
          ) : (
            <GenerateInvoicesForm classes={classOptions} defaultMonth={currentMonth()} />
          )}
        </CardContent>
      </Card>

      {pending.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {pending.length} payment{pending.length === 1 ? "" : "s"} awaiting verification
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-border divide-y">
              {pending.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="min-w-0 space-y-1">
                    <p className="text-sm font-medium">
                      <Link href={`/fees/students/${p.studentId}`} className="hover:underline">
                        {p.studentName}
                      </Link>
                      <span className="text-muted-foreground ml-2 font-normal">
                        {p.invoiceTitle}
                      </span>
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {formatPKR(p.amount)} · ref {p.reference ?? "-"} · {formatDay(p.createdAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <form action={verifyPaymentAction}>
                      <input type="hidden" name="id" value={p.id} />
                      <Button type="submit" size="sm">
                        Verify
                      </Button>
                    </form>
                    <form action={rejectPaymentAction}>
                      <input type="hidden" name="id" value={p.id} />
                      <Button type="submit" size="sm" variant="outline">
                        Reject
                      </Button>
                    </form>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="text-base">
              {invoices.length} {invoices.length === 1 ? "invoice" : "invoices"}
            </CardTitle>
            {/* Plain GET form: filters via the URL, no client JS. */}
            <form method="get" className="flex items-end gap-2">
              <select
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
              <input
                type="month"
                name="period"
                defaultValue={period ?? ""}
                className="border-input dark:bg-input/30 h-9 rounded-md border bg-transparent px-2 text-sm"
              />
              <Button type="submit" variant="outline" size="sm">
                Filter
              </Button>
            </form>
          </div>
        </CardHeader>
        <CardContent>
          {invoices.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No invoices{classId || period ? " for this filter" : " yet"}. Generate a month above.
            </p>
          ) : (
            <ul className="divide-border divide-y">
              {invoices.map((inv) => (
                <li key={inv.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0 space-y-1">
                    <p className="text-sm font-medium">
                      <Link href={`/fees/students/${inv.studentId}`} className="hover:underline">
                        {inv.studentName}
                      </Link>
                      {inv.rollNumber ? (
                        <span className="text-muted-foreground ml-2 font-normal">
                          #{inv.rollNumber}
                        </span>
                      ) : null}
                    </p>
                    <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
                      <span>{inv.title}</span>
                      {inv.className ? <span>{inv.className}</span> : null}
                      {inv.dueDate ? <span>Due {formatDay(inv.dueDate)}</span> : null}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-right">
                    <div className="text-sm">
                      <p className="font-medium">{formatPKR(inv.total)}</p>
                      {Number(inv.balance) > 0 ? (
                        <p className="text-muted-foreground text-xs">
                          Bal {formatPKR(inv.balance)}
                        </p>
                      ) : null}
                    </div>
                    <InvoiceStatusBadge status={inv.status} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
