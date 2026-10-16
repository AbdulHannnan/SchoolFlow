import type { ExamPaperStatus } from "@prisma/client";

import { Badge } from "@/components/ui/badge";

const LABELS: Record<ExamPaperStatus, string> = {
  SUBMITTED: "Awaiting review",
  APPROVED: "Approved",
  CHANGES_REQUESTED: "Changes requested",
};

const CLASS: Record<ExamPaperStatus, string> = {
  SUBMITTED:
    "border-transparent bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
  APPROVED:
    "border-transparent bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400",
  CHANGES_REQUESTED:
    "border-transparent bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400",
};

/** A themed badge for an exam paper's review status. */
export function ExamPaperStatusBadge({ status }: { status: ExamPaperStatus }) {
  return <Badge className={CLASS[status]}>{LABELS[status]}</Badge>;
}
