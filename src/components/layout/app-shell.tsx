import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";

/**
 * Basic application shell: a persistent sidebar plus a header over a scrollable
 * content area. Wrap page content with this. In a later module this moves into a
 * route-group layout once authenticated routes exist.
 */
export function AppShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header title={title} />
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
