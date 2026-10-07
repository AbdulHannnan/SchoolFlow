import Link from "next/link";
import { ShieldX } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function Forbidden() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-4 p-6 text-center">
      <ShieldX className="text-muted-foreground size-10" />
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">403 — Forbidden</h1>
        <p className="text-muted-foreground text-sm">
          You don&apos;t have permission to access this page.
        </p>
      </div>
      <Button asChild size="sm">
        <Link href="/">Back to dashboard</Link>
      </Button>
    </main>
  );
}
