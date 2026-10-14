import "server-only";

import { requireRole, requireSchool } from "@/server/auth/dal";
import { withTenant } from "@/server/db/tenant";
import { toDateOnly } from "@/server/academics/attendance";
import { listChildrenProgress } from "@/server/academics/progress";
import { listChildrenDiary } from "@/server/academics/diary";
import { listChildrenLedgerSummaries } from "@/server/fees/invoices";

/**
 * The signed-in parent's overview of their children (Module 9.3). Composes the
 * parent-scoped reads that already resolve "my children" from the ParentStudent
 * links - this month's attendance, outstanding fees and recent homework - into
 * one row per child, plus headline totals.
 *
 * Read at request time behind a <Suspense> boundary, like the rest of the DAL.
 */

export type ParentChildRow = {
  student: {
    id: string;
    name: string;
    className: string | null;
    sectionName: string | null;
  };
  attendance: { presentRate: number | null; markedDays: number };
  fees: { balance: number; invoiceCount: number };
  latestHomework: { title: string; date: Date; subject: string | null } | null;
};

export type ParentDashboard = {
  month: string;
  children: ParentChildRow[];
  totals: {
    children: number;
    outstanding: number;
    homeworkThisWeek: number;
    unread: number;
  };
};

/** Monday (UTC day boundary) of the week containing `now`. */
function weekStart(now: Date): Date {
  const DAY = 24 * 60 * 60 * 1000;
  const today = toDateOnly(now);
  const mondayOffset = (today.getUTCDay() + 6) % 7;
  return new Date(today.getTime() - mondayOffset * DAY);
}

export async function getParentDashboard(): Promise<ParentDashboard> {
  await requireRole("PARENT");
  const { user, schoolId } = await requireSchool();

  const [{ month, children: progress }, ledgers, diary] = await Promise.all([
    listChildrenProgress(),
    listChildrenLedgerSummaries(),
    listChildrenDiary(),
  ]);

  const unread = await withTenant(schoolId, (tx) =>
    tx.notification.count({ where: { recipientId: user.id, readAt: null } }),
  );

  const ledgerById = new Map(ledgers.map((l) => [l.student.id, l]));
  const diaryById = new Map(diary.children.map((c) => [c.student.id, c.entries]));

  const monday = weekStart(new Date()).getTime();
  let homeworkThisWeek = 0;

  const children: ParentChildRow[] = progress.map((row) => {
    const ledger = ledgerById.get(row.student.id);
    const entries = diaryById.get(row.student.id) ?? [];
    const latest = entries[0] ?? null;

    for (const e of entries) {
      if (e.date.getTime() >= monday) homeworkThisWeek += 1;
    }

    return {
      student: {
        id: row.student.id,
        name: row.student.name,
        className: row.student.class?.name ?? null,
        sectionName: row.student.section?.name ?? null,
      },
      attendance: { presentRate: row.presentRate, markedDays: row.markedDays },
      fees: {
        balance: ledger ? Number(ledger.balance) : 0,
        invoiceCount: ledger?.invoiceCount ?? 0,
      },
      latestHomework: latest
        ? { title: latest.title, date: latest.date, subject: latest.subject?.name ?? null }
        : null,
    };
  });

  const outstanding = children.reduce((sum, c) => sum + Math.max(0, c.fees.balance), 0);

  return {
    month,
    children,
    totals: {
      children: children.length,
      outstanding,
      homeworkThisWeek,
      unread,
    },
  };
}
