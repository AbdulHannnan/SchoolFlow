import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Shared building blocks for the role dashboards (Module 9). A `StatTile` is a
 * small clickable number; a `SectionCard` is a titled panel with a "view more"
 * link into the relevant area; `EmptyRow` is the muted placeholder a section
 * shows when it has nothing to list.
 */

export function StatTile({
  icon: Icon,
  label,
  value,
  href,
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="focus-visible:ring-ring rounded-xl focus-visible:ring-2 focus-visible:outline-none"
    >
      <Card className="hover:border-primary/50 hover:bg-accent/40 h-full gap-2 py-4 transition-colors">
        <CardHeader className="px-4">
          <div className="text-muted-foreground flex items-center gap-2">
            <Icon className="size-4" />
            <CardDescription>{label}</CardDescription>
          </div>
          <CardTitle className="text-3xl tabular-nums">{value}</CardTitle>
        </CardHeader>
      </Card>
    </Link>
  );
}

export function SectionCard({
  icon: Icon,
  title,
  href,
  hint,
  children,
}: {
  icon: LucideIcon;
  title: string;
  href: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <Icon className="text-muted-foreground size-5" />
            <CardTitle className="text-base">{title}</CardTitle>
          </div>
          <Link
            href={href}
            className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-sm"
          >
            {hint ?? "View"}
            <ArrowRight className="size-3.5" />
          </Link>
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export function EmptyRow({ children }: { children: React.ReactNode }) {
  return <p className="text-muted-foreground text-sm">{children}</p>;
}
