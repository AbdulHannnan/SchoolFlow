import { Suspense } from "react";
import type { Metadata } from "next";

import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InvoiceStatusBadge } from "@/components/fees/invoice-status-badge";
import { PaymentStatusBadge } from "@/components/fees/payment-status-badge";
import { RecordPaymentForm } from "@/components/fees/record-payment-form";
import { SubmitBankTransferForm } from "@/components/fees/submit-bank-transfer-form";
import { verifySession } from "@/server/auth/dal";
import { getStudentLedger, type LedgerInvoice } from "@/server/fees/invoices";
import { formatDay } from "@/lib/attendance";
import { formatPKR, PAYMENT_METHOD_LABELS } from "@/lib/money";

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
  const user = await verifySession();
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
  const role = user.role;

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
        invoices.map((inv) => <InvoiceCard key={inv.id} inv={inv} role={role} />)
      )}
    </div>
  );
}

function InvoiceCard({ inv, role }: { inv: LedgerInvoice; role: string }) {
  const hasBalance = Number(inv.balance) > 0 && inv.status !== "CANCELLED";
  return (
    <Card>
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
        <div className="text-muted-foreground flex justify-between gap-2 text-sm">
          <span>Paid</span>
          <span>
            {formatPKR(inv.paidAmount)} · balance {formatPKR(inv.balance)}
          </span>
        </div>

        {inv.payments.length > 0 ? (
          <ul className="space-y-1 border-t pt-2 text-sm">
            {inv.payments.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-muted-foreground">
                  {formatDay(p.createdAt)} · {PAYMENT_METHOD_LABELS[p.method]}
                  {p.reference ? ` · ${p.reference}` : ""}
                </span>
                <span className="flex items-center gap-2">
                  {formatPKR(p.amount)}
                  <PaymentStatusBadge status={p.status} />
                </span>
              </li>
            ))}
          </ul>
        ) : null}

        {hasBalance && role === "HEAD" ? (
          <div className="border-t pt-3">
            <RecordPaymentForm invoiceId={inv.id} defaultAmount={inv.balance} />
          </div>
        ) : null}
        {hasBalance && role === "PARENT" ? (
          <div className="border-t pt-3">
            <SubmitBankTransferForm invoiceId={inv.id} defaultAmount={inv.balance} />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
