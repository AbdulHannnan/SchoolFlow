import "server-only";

import { requireSchool } from "@/server/auth/dal";
import { withTenant } from "@/server/db/tenant";
import { dispatch } from "@/server/notifications/dispatch";
import { formatDay } from "@/lib/attendance";
import { formatPKR } from "@/lib/money";

/**
 * Fee reminders (Module 6.4): emit a FEE_REMINDER through the notification
 * engine to the parents of every student with an outstanding balance. Balances
 * are aggregated per student across their unpaid/partial invoices (optionally
 * filtered to a class or billing month), so a parent gets one reminder per
 * child, not one per invoice. Dispatched on in-app + WhatsApp; the dispatcher
 * isolates channel failures. Students with no linked parent are skipped.
 */

export type ReminderResult = {
  /** Students a reminder was sent for (i.e. had an outstanding balance and ≥1 parent). */
  students: number;
  /** Total parent recipients notified. */
  reminders: number;
  /** Students with an outstanding balance but no linked parent. */
  skipped: number;
};

export async function sendFeeReminders(input?: {
  classId?: string | null;
  period?: string | null;
}): Promise<ReminderResult> {
  const { schoolId } = await requireSchool();

  const { toSend, skipped } = await withTenant(schoolId, async (tx) => {
    const outstanding = await tx.invoice.findMany({
      where: {
        status: { in: ["UNPAID", "PARTIAL"] },
        ...(input?.classId ? { classId: input.classId } : {}),
        ...(input?.period ? { period: input.period } : {}),
      },
      select: {
        studentId: true,
        total: true,
        paidAmount: true,
        dueDate: true,
        student: { select: { name: true } },
      },
    });

    // Aggregate per student: total balance and earliest due date.
    const byStudent = new Map<string, { name: string; balance: number; due: Date | null }>();
    for (const inv of outstanding) {
      const balance = Number(inv.total.toString()) - Number(inv.paidAmount.toString());
      if (balance <= 0) continue;
      const cur = byStudent.get(inv.studentId) ?? { name: inv.student.name, balance: 0, due: null };
      cur.balance += balance;
      if (inv.dueDate && (cur.due === null || inv.dueDate < cur.due)) cur.due = inv.dueDate;
      byStudent.set(inv.studentId, cur);
    }

    const studentIds = [...byStudent.keys()];
    const parentsByStudent = new Map<string, string[]>();
    if (studentIds.length > 0) {
      const links = await tx.parentStudent.findMany({
        where: { studentId: { in: studentIds } },
        select: { studentId: true, parentId: true },
      });
      for (const link of links) {
        const list = parentsByStudent.get(link.studentId) ?? [];
        list.push(link.parentId);
        parentsByStudent.set(link.studentId, list);
      }
    }

    const toSend: {
      studentId: string;
      studentName: string;
      amount: string;
      dueDate: string | null;
      parentIds: string[];
    }[] = [];
    let skipped = 0;
    for (const [studentId, info] of byStudent) {
      const parentIds = parentsByStudent.get(studentId) ?? [];
      if (parentIds.length === 0) {
        skipped += 1;
        continue;
      }
      toSend.push({
        studentId,
        studentName: info.name,
        amount: formatPKR(info.balance.toFixed(2)),
        dueDate: info.due ? formatDay(info.due) : null,
        parentIds,
      });
    }

    return { toSend, skipped };
  });

  for (const r of toSend) {
    await dispatch({
      type: "FEE_REMINDER",
      schoolId,
      recipientIds: r.parentIds,
      studentId: r.studentId,
      studentName: r.studentName,
      amount: r.amount,
      dueDate: r.dueDate,
      channels: ["in-app", "whatsapp"],
    });
  }

  const reminders = toSend.reduce((sum, r) => sum + r.parentIds.length, 0);
  return { students: toSend.length, reminders, skipped };
}
