import { Suspense } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";

import { getSessionUser } from "@/server/auth/dal";
import { Button } from "@/components/ui/button";
import { SignOutButton } from "@/components/auth/sign-out-button";

/**
 * Top bar of the app shell. The static chrome (title) prerenders into the
 * shell; the user section reads the session at request time, so it streams in
 * behind a Suspense boundary (required with Cache Components enabled).
 */
export function Header({ title }: { title: string }) {
  return (
    <header className="bg-background/80 sticky top-0 z-10 flex h-14 items-center gap-4 border-b px-4 backdrop-blur md:px-6">
      <h1 className="text-base font-semibold">{title}</h1>

      <div className="ml-auto flex items-center gap-2">
        <Suspense fallback={<div className="bg-muted h-8 w-24 animate-pulse rounded-md" />}>
          <HeaderUser />
        </Suspense>
      </div>
    </header>
  );
}

async function HeaderUser() {
  const user = await getSessionUser();

  if (!user) {
    return (
      <Button asChild size="sm">
        <Link href="/login">Sign in</Link>
      </Button>
    );
  }

  return (
    <>
      <Button variant="ghost" size="icon" aria-label="Notifications">
        <Bell />
      </Button>
      <div className="hidden text-right sm:block">
        <div className="text-sm leading-tight font-medium">{user.name}</div>
        <div className="text-muted-foreground text-xs">{formatRole(user.role)}</div>
      </div>
      <SignOutButton />
    </>
  );
}

/** "SUPER_ADMIN" → "Super admin" */
function formatRole(role: string): string {
  const lower = role.toLowerCase().replace(/_/g, " ");
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}
