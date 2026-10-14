import { Suspense } from "react";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { navItems } from "@/config/nav";
import { hasRole, verifySession } from "@/server/auth/dal";
import { getDashboardCounts } from "@/server/dashboard";
import { HeadDashboard } from "@/components/dashboard/head-dashboard";

export default function Home() {
  return (
    <AppShell title="Dashboard">
      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardContent />
      </Suspense>
    </AppShell>
  );
}

async function DashboardContent() {
  // Gates the page: signed-out visitors are redirected to /login.
  const user = await verifySession();

  const isHead = hasRole(user, "HEAD");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Welcome, {user.name}</h2>
          <p className="text-muted-foreground text-sm">
            {isHead
              ? "Your school at a glance. Use the sidebar to drill into any area."
              : "Jump to any area below, or use the sidebar to navigate."}
          </p>
        </div>
        {hasRole(user, "SUPER_ADMIN") ? (
          <Button asChild variant="outline" size="sm">
            <Link href="/admin">
              <ShieldCheck />
              Administration
            </Link>
          </Button>
        ) : null}
      </div>

      {isHead ? <HeadDashboard /> : <NavGrid />}
    </div>
  );
}

async function NavGrid() {
  const user = await verifySession();

  // Live per-area counts for tenant users; SUPER_ADMIN has no school, so skip.
  const counts = user.schoolId ? await getDashboardCounts() : {};

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {navItems
        .filter((item) => item.href !== "/")
        .map((item) =>
          item.ready ? (
            <Link
              key={item.href}
              href={item.href}
              className="focus-visible:ring-ring rounded-xl focus-visible:ring-2 focus-visible:outline-none"
            >
              <Card className="hover:border-primary/50 hover:bg-accent/40 h-full transition-colors">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <item.icon className="text-muted-foreground size-5" />
                    <CardTitle>{item.title}</CardTitle>
                  </div>
                  <CardDescription>{counts[item.href] ?? item.description}</CardDescription>
                </CardHeader>
              </Card>
            </Link>
          ) : (
            <Card key={item.href} className="h-full opacity-60">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <item.icon className="text-muted-foreground size-5" />
                  <CardTitle>{item.title}</CardTitle>
                </div>
                <CardDescription>{item.description} - coming soon.</CardDescription>
              </CardHeader>
            </Card>
          ),
        )}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="bg-muted h-6 w-48 animate-pulse rounded" />
        <div className="bg-muted h-4 w-80 animate-pulse rounded" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-muted h-28 animate-pulse rounded-xl" />
        ))}
      </div>
    </div>
  );
}
