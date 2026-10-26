import { Suspense } from "react";
import { GraduationCap } from "lucide-react";

import { getSessionUser } from "@/server/auth/dal";
import { SidebarNav } from "@/components/layout/sidebar-nav";

/**
 * Persistent left navigation for the app shell. Hidden on small screens (the
 * header exposes it there in a later pass); shown as a fixed column from `md` up.
 *
 * The logo chrome prerenders into the static shell; the link list depends on
 * the signed-in role, which is request-time session data, so it streams in
 * behind a Suspense boundary (required with Cache Components enabled).
 */
export function Sidebar() {
  return (
    <aside className="bg-sidebar text-sidebar-foreground border-sidebar-border no-print hidden w-64 shrink-0 flex-col border-r md:flex">
      <div className="flex h-14 items-center gap-2 px-4">
        <GraduationCap className="size-6" />
        <span className="font-semibold">School</span>
      </div>

      <Suspense fallback={<SidebarNavSkeleton />}>
        <SidebarNavLoader />
      </Suspense>
    </aside>
  );
}

function SidebarNavSkeleton() {
  return (
    <nav className="flex-1 space-y-1 px-3 py-2" aria-hidden>
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-3 py-2">
          <div className="bg-sidebar-foreground/10 size-4 shrink-0 animate-pulse rounded" />
          <div className="bg-sidebar-foreground/10 h-4 w-28 animate-pulse rounded" />
        </div>
      ))}
    </nav>
  );
}

async function SidebarNavLoader() {
  const user = await getSessionUser();
  return <SidebarNav role={user?.role ?? null} />;
}
