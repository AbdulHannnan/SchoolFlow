"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Role } from "@prisma/client";

import { cn } from "@/lib/utils";
import { navItemsForRole } from "@/config/nav";

/**
 * The sidebar's link list. Client-side because active state depends on the
 * current pathname; the role is resolved on the server and passed in so the
 * list only renders the areas this role is allowed to see.
 */
export function SidebarNav({ role }: { role: Role | null }) {
  const pathname = usePathname();

  return (
    <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
      {navItemsForRole(role).map((item) => {
        const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);

        if (!item.ready) {
          return (
            <span
              key={item.href}
              aria-disabled="true"
              title="Coming soon"
              className="text-sidebar-foreground/40 flex cursor-not-allowed items-center gap-3 rounded-md px-3 py-2 text-sm font-medium"
            >
              <item.icon className="size-4" />
              {item.title}
            </span>
          );
        }

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
            )}
          >
            <item.icon className="size-4" />
            {item.title}
          </Link>
        );
      })}
    </nav>
  );
}
