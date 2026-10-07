import { Bell, UserCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Top bar of the app shell. Holds the page-level actions; user menu and
 * notifications are placeholders until their modules land (auth: 1.3, notifications: 4).
 */
export function Header({ title }: { title: string }) {
  return (
    <header className="bg-background/80 sticky top-0 z-10 flex h-14 items-center gap-4 border-b px-4 backdrop-blur md:px-6">
      <h1 className="text-base font-semibold">{title}</h1>

      <div className="ml-auto flex items-center gap-1">
        <Button variant="ghost" size="icon" aria-label="Notifications">
          <Bell />
        </Button>
        <Button variant="ghost" size="icon" aria-label="Account">
          <UserCircle2 />
        </Button>
      </div>
    </header>
  );
}
