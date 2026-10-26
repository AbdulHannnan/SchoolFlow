import {
  LayoutDashboard,
  Layers,
  BookOpen,
  GraduationCap,
  Users,
  Contact,
  CalendarCheck,
  UserCheck,
  CalendarRange,
  CalendarClock,
  NotebookPen,
  ClipboardList,
  TrendingUp,
  TriangleAlert,
  Wallet,
  Bell,
  Settings,
  type LucideIcon,
} from "lucide-react";

import type { Role } from "@prisma/client";

export type NavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  /** One-line summary shown on the dashboard tile. */
  description: string;
  /** Roadmap module that delivers this area. */
  module: string;
  /** Whether the route is live. A not-ready item renders but doesn't link. */
  ready: boolean;
  /**
   * Roles that should NOT see this item in the sidebar/dashboard. Undefined
   * means every role sees it. This only hides the nav entry; route-level
   * authorization still lives in the DAL.
   */
  hideForRoles?: Role[];
};

/**
 * Primary navigation - the single source of truth for both the sidebar and the
 * dashboard tiles. Every `ready` entry has a real route; a not-ready entry is
 * shown as "coming soon" and is never turned into a link.
 */
export const navItems: NavItem[] = [
  { title: "Dashboard", href: "/", icon: LayoutDashboard, description: "Overview and quick links", module: "9.1", ready: true }, // prettier-ignore
  { title: "Classes", href: "/classes", icon: Layers, description: "Grades and their sections", module: "2.1", ready: true }, // prettier-ignore
  { title: "Subjects", href: "/subjects", icon: BookOpen, description: "Subjects defined per class", module: "2.2", ready: true }, // prettier-ignore
  { title: "Students", href: "/students", icon: GraduationCap, description: "Enrol and manage students", module: "2.4", ready: true }, // prettier-ignore
  { title: "Teachers", href: "/teachers", icon: Users, description: "Staff and class assignments", module: "2.3", ready: true, hideForRoles: ["TEACHER"] }, // prettier-ignore
  { title: "Parents", href: "/parents", icon: Contact, description: "Guardians and student links", module: "2.5", ready: true, hideForRoles: ["TEACHER"] }, // prettier-ignore
  { title: "Attendance", href: "/attendance", icon: CalendarCheck, description: "Mark and review attendance", module: "3", ready: true, hideForRoles: ["TEACHER"] }, // prettier-ignore
  { title: "Staff Attendance", href: "/staff-attendance", icon: UserCheck, description: "Mark and review staff attendance", module: "8.1", ready: true, hideForRoles: ["TEACHER"] }, // prettier-ignore
  { title: "Planner", href: "/planner", icon: CalendarRange, description: "Teacher lesson-plan register", module: "8.2", ready: true }, // prettier-ignore
  { title: "Meetings", href: "/meetings", icon: CalendarClock, description: "Staff meetings and invites", module: "8.3", ready: true }, // prettier-ignore
  { title: "Homework", href: "/homework", icon: NotebookPen, description: "Daily diary and homework", module: "5", ready: true }, // prettier-ignore
  { title: "Exams", href: "/exams", icon: ClipboardList, description: "Exams, grades and report cards", module: "7", ready: true }, // prettier-ignore
  { title: "Progress", href: "/progress", icon: TrendingUp, description: "Class and student progress", module: "7.4", ready: true }, // prettier-ignore
  { title: "Red Flags", href: "/red-flags", icon: TriangleAlert, description: "At-risk alerts and rules", module: "7.3", ready: true }, // prettier-ignore
  { title: "Fees", href: "/fees", icon: Wallet, description: "Invoices, payments and reminders", module: "6", ready: true }, // prettier-ignore
  { title: "Notifications", href: "/notifications", icon: Bell, description: "Alerts and messages", module: "4", ready: true }, // prettier-ignore
  { title: "Settings", href: "/settings", icon: Settings, description: "School profile and preferences", module: "1.6", ready: false }, // prettier-ignore
];

/**
 * Nav items visible to a given role. A `null` role (signed out) sees the full
 * list; otherwise items that list the role in `hideForRoles` are dropped.
 */
export function navItemsForRole(role: Role | null | undefined): NavItem[] {
  if (!role) return navItems;
  return navItems.filter((item) => !item.hideForRoles?.includes(role));
}
