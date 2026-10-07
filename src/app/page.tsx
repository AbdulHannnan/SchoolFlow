import { Suspense } from "react";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { navItems } from "@/config/nav";
import { hasRole, verifySession } from "@/server/auth/dal";

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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Welcome, {user.name}</h2>
          <p className="text-muted-foreground text-sm">
            Module 1 complete - multi-tenant auth, RBAC, RLS isolation, and tenant onboarding.
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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {navItems
          .filter((item) => item.href !== "/")
          .map((item) => (
            <Card key={item.href}>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <item.icon className="text-muted-foreground size-5" />
                  <CardTitle>{item.title}</CardTitle>
                </div>
                <CardDescription>Arrives in module {item.module}.</CardDescription>
              </CardHeader>
            </Card>
          ))}
      </div>
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
