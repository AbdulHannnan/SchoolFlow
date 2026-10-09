import type { ComponentProps } from "react";
import type { PaymentStatus } from "@prisma/client";

import { Badge } from "@/components/ui/badge";
import { PAYMENT_STATUS_LABELS } from "@/lib/money";

const VARIANT: Record<PaymentStatus, ComponentProps<typeof Badge>["variant"]> = {
  PENDING: "secondary",
  VERIFIED: "default",
  REJECTED: "destructive",
};

/** A themed badge for a payment's verification status. */
export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  return <Badge variant={VARIANT[status]}>{PAYMENT_STATUS_LABELS[status]}</Badge>;
}
