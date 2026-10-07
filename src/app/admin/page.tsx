import { Suspense } from "react";
import type { Metadata } from "next";

import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CreateSchoolForm } from "@/components/admin/create-school-form";
import { requireSuperAdmin } from "@/server/auth/dal";
import { prisma } from "@/server/db";

export const metadata: Metadata = {
  title: "Administration - School Management",
};

export default function AdminPage() {
  return (
    <AppShell title="Administration">
      <Suspense fallback={<div className="bg-muted h-64 animate-pulse rounded-xl" />}>
        <AdminContent />
      </Suspense>
    </AppShell>
  );
}

async function AdminContent() {
  // SUPER_ADMIN only - renders the 403 boundary otherwise.
  await requireSuperAdmin();

  // Owner connection (bypasses RLS) so the platform operator sees every tenant.
  const schools = await prisma.school.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { users: true } } },
  });

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">Onboard a school</h2>
          <p className="text-muted-foreground text-sm">
            Creates the tenant and its first HEAD account.
          </p>
        </div>
        <Card>
          <CardContent className="pt-6">
            <CreateSchoolForm />
          </CardContent>
        </Card>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">Schools</h2>
          <p className="text-muted-foreground text-sm">
            {schools.length} {schools.length === 1 ? "tenant" : "tenants"}.
          </p>
        </div>

        {schools.length === 0 ? (
          <p className="text-muted-foreground text-sm">No schools yet.</p>
        ) : (
          <div className="space-y-3">
            {schools.map((school) => (
              <Card key={school.id}>
                <CardHeader>
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-base">{school.name}</CardTitle>
                    <span
                      className={
                        school.isActive
                          ? "text-primary text-xs font-medium"
                          : "text-muted-foreground text-xs font-medium"
                      }
                    >
                      {school.isActive ? "Active" : "Suspended"}
                    </span>
                  </div>
                  <CardDescription>
                    <code>{school.slug}</code> - {school._count.users}{" "}
                    {school._count.users === 1 ? "user" : "users"}
                  </CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
