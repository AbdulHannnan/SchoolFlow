import type { ComponentProps } from "react";
import type { InvoiceStatus } from "@prisma/client";

import { Badge } from "@/components/ui/badge";
import { INVOICE_STATUS_LABELS } from "@/lib/money";

const VARIANT: Record<InvoiceStatus, ComponentProps<typeof Badge>["variant"]> = {
  UNPAID: "destructive",
  PARTIAL: "secondary",
  PAID: "default",
  CANCELLED: "outline",
};

/** A themed badge for an invoice's payment status. */
export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  return <Badge variant={VARIANT[status]}>{INVOICE_STATUS_LABELS[status]}</Badge>;
}
