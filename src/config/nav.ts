import {
  LayoutDashboard,
  Layers,
  GraduationCap,
  Users,
  CalendarCheck,
  NotebookPen,
  Wallet,
  Bell,
  Settings,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  /** Roadmap module that delivers this area; the route is a placeholder until then. */
  module: string;
};

/**
 * Primary sidebar navigation. Entries mirror the product roadmap — most routes
 * are placeholders that get real pages as their module lands. Keep this list as
 * the single source of truth for the shell's navigation.
 */
export const navItems: NavItem[] = [
  { title: "Dashboard", href: "/", icon: LayoutDashboard, module: "9.1" },
  { title: "Classes", href: "/classes", icon: Layers, module: "2.1" },
  { title: "Students", href: "/students", icon: GraduationCap, module: "2.4" },
  { title: "Teachers", href: "/teachers", icon: Users, module: "2.3" },
  { title: "Attendance", href: "/attendance", icon: CalendarCheck, module: "3" },
  { title: "Homework", href: "/homework", icon: NotebookPen, module: "5" },
  { title: "Fees", href: "/fees", icon: Wallet, module: "6" },
  { title: "Notifications", href: "/notifications", icon: Bell, module: "4" },
  { title: "Settings", href: "/settings", icon: Settings, module: "1.6" },
];
