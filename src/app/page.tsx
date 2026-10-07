import { AppShell } from "@/components/layout/app-shell";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { navItems } from "@/config/nav";

export default function Home() {
  return (
    <AppShell title="Dashboard">
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold">Foundation ready</h2>
          <p className="text-muted-foreground text-sm">
            Module 0.3 — Tailwind CSS v4 and shadcn/ui are wired into a basic app shell. Next up:
            Module 1 (multi-tenancy &amp; auth).
          </p>
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
    </AppShell>
  );
}
