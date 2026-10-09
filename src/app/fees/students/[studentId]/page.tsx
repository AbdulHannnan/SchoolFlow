import { Suspense } from "react";
import type { Metadata } from "next";

import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InvoiceStatusBadge } from "@/components/fees/invoice-status-badge";
import { getStudentLedger } from "@/server/fees/invoices";
import { formatDay } from "@/lib/attendance";
import { formatPKR } from "@/lib/money";

export const metadata: Metadata = {
  title: "Ledger - School Management",
};

// Dynamic route: the shell's `usePathname()` has no statically-known path for a
// `[studentId]` segment, so render on demand rather than prerendering a static
// shell. See the Cache Components notes.
export const instant = false;

type Params = Promise<{ studentId: string }>;

export default function StudentLedgerPage({ params }: { params: Params }) {
  return (
    <AppShell title="Student Ledger">
      <Suspense fallback={<div className="bg-muted h-64 animate-pulse rounded-xl" />}>
        <LedgerContent params={params} />
      </Suspense>
    </AppShell>
  );
}

async function LedgerContent({ params }: { params: Params }) {
  const { studentId } = await params;
  // getStudentLedger authorizes: HEAD any student, PARENT only a linked child.
  let data: Awaited<ReturnType<typeof getStudentLedger>> | null = null;
  let error: string | null = null;
  try {
    data = await getStudentLedger(studentId);
  } catch (e) {
    error = e instanceof Error ? e.message : "Unable to load this ledger.";
  }
  if (error || !data) {
    return <p className="text-muted-foreground text-sm">{error ?? "Ledger not available."}</p>;
  }
  const { student, invoices, summary } = data;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {student.name}
            <span className="text-muted-foreground ml-2 text-sm font-normal">
              {student.class?.name ?? ""}
              {student.section ? ` - ${student.section.name}` : ""}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground text-xs">Billed</p>
              <p className="font-medium">{formatPKR(summary.billed)}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Paid</p>
              <p className="font-medium">{formatPKR(summary.paid)}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Balance</p>
              <p className={`font-medium ${Number(summary.balance) > 0 ? "text-destructive" : ""}`}>
                {formatPKR(summary.balance)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {invoices.length === 0 ? (
        <p className="text-muted-foreground text-sm">No invoices for this student yet.</p>
      ) : (
        invoices.map((inv) => (
          <Card key={inv.id}>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="text-base">
                  {inv.title}
                  {inv.dueDate ? (
                    <span className="text-muted-foreground ml-2 text-sm font-normal">
                      due {formatDay(inv.dueDate)}
                    </span>
                  ) : null}
                </CardTitle>
                <InvoiceStatusBadge status={inv.status} />
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <ul className="divide-border divide-y text-sm">
                {inv.lineItems.map((li) => (
                  <li key={li.id} className="flex justify-between gap-2 py-1.5">
                    <span>{li.description}</span>
                    <span>{formatPKR(li.amount)}</span>
                  </li>
                ))}
              </ul>
              <div className="flex justify-between gap-2 border-t pt-2 text-sm font-medium">
                <span>Total</span>
                <span>{formatPKR(inv.total)}</span>
              </div>
              {Number(inv.paidAmount) > 0 ? (
                <div className="text-muted-foreground flex justify-between gap-2 text-sm">
                  <span>Paid</span>
                  <span>
                    {formatPKR(inv.paidAmount)} · balance {formatPKR(inv.balance)}
                  </span>
                </div>
              ) : null}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
