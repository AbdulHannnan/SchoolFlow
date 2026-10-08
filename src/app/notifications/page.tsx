import { Suspense } from "react";
import type { Metadata } from "next";
import { BellOff } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { markAllReadAction, markReadAction } from "@/app/notifications/actions";
import { EnablePushButton } from "@/components/notifications/enable-push-button";
import { requireSchool } from "@/server/auth/dal";
import { listMyNotifications } from "@/server/notifications/notifications";

export const metadata: Metadata = {
  title: "Notifications - School Management",
};

export default function NotificationsPage() {
  return (
    <AppShell title="Notifications">
      <Suspense fallback={<div className="bg-muted h-64 animate-pulse rounded-xl" />}>
        <NotificationsContent />
      </Suspense>
    </AppShell>
  );
}

async function NotificationsContent() {
  // Any signed-in tenant user has an inbox; the read model scopes it to them.
  await requireSchool();
  const notifications = await listMyNotifications();
  const unread = notifications.filter((n) => n.readAt === null).length;

  if (notifications.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex justify-end">
          <EnablePushButton />
        </div>
        <div className="text-muted-foreground flex flex-col items-center gap-3 py-16 text-center text-sm">
          <BellOff className="size-8" />
          <p>No notifications yet.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground text-sm">
          {unread > 0 ? `${unread} unread` : "All caught up"}
        </p>
        <div className="flex items-center gap-3">
          <EnablePushButton />
          {unread > 0 ? (
            <form action={markAllReadAction}>
              <Button type="submit" variant="outline" size="sm">
                Mark all read
              </Button>
            </form>
          ) : null}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {notifications.length} {notifications.length === 1 ? "notification" : "notifications"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="divide-border divide-y">
            {notifications.map((n) => {
              const isUnread = n.readAt === null;
              return (
                <li key={n.id} className="flex items-start gap-3 py-3">
                  <span
                    aria-hidden
                    className={`mt-1.5 size-2 shrink-0 rounded-full ${
                      isUnread ? "bg-primary" : "bg-transparent"
                    }`}
                  />
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`text-sm ${isUnread ? "font-semibold" : "font-medium"}`}>
                        {n.title}
                      </span>
                      <Badge variant="secondary" className="font-mono text-[10px]">
                        {typeLabel(n.type)}
                      </Badge>
                    </div>
                    <p className="text-muted-foreground text-sm">{n.body}</p>
                    <p className="text-muted-foreground text-xs">{formatWhen(n.createdAt)}</p>
                  </div>
                  {isUnread ? (
                    <form action={markReadAction}>
                      <input type="hidden" name="id" value={n.id} />
                      <Button
                        type="submit"
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground"
                      >
                        Mark read
                      </Button>
                    </form>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

const TYPE_LABELS: Record<string, string> = {
  GENERAL: "General",
  ATTENDANCE_ABSENT: "Attendance",
};

function typeLabel(type: string): string {
  return TYPE_LABELS[type] ?? type;
}

/** "9 Oct 2026, 14:30" in a stable, locale-independent form. */
function formatWhen(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
