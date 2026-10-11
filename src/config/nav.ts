import {
  LayoutDashboard,
  Layers,
  BookOpen,
  GraduationCap,
  Users,
  Contact,
  CalendarCheck,
  NotebookPen,
  ClipboardList,
  TrendingUp,
  TriangleAlert,
  Wallet,
  Bell,
  Settings,
  type LucideIcon,
} from "lucide-react";

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
};

/**
 * Primary navigation - the single source of truth for both the sidebar and the
 * dashboard tiles. Every `ready` entry has a real route; a not-ready entry is
 * shown as "coming soon" and is never turned into a link.
 */
export const navItems: NavItem[] = [
  { title: "Dashboard", href: "/", icon: LayoutDashboard, description: "Overview and quick links", module: "9.1", ready: true }, // prettier-ignore
  { title: "Classes", href: "/classes", icon: Layers, description: "Grades and their sections", module: "2.1", ready: true }, // prettier-ignore
  { title: "Subjects", href: "/subjects", icon: BookOpen, description: "Subjects taught at the school", module: "2.2", ready: true }, // prettier-ignore
  { title: "Students", href: "/students", icon: GraduationCap, description: "Enrol and manage students", module: "2.4", ready: true }, // prettier-ignore
  { title: "Teachers", href: "/teachers", icon: Users, description: "Staff and class assignments", module: "2.3", ready: true }, // prettier-ignore
  { title: "Parents", href: "/parents", icon: Contact, description: "Guardians and student links", module: "2.5", ready: true }, // prettier-ignore
  { title: "Attendance", href: "/attendance", icon: CalendarCheck, description: "Mark and review attendance", module: "3", ready: true }, // prettier-ignore
  { title: "Homework", href: "/homework", icon: NotebookPen, description: "Daily diary and homework", module: "5", ready: true }, // prettier-ignore
  { title: "Exams", href: "/exams", icon: ClipboardList, description: "Exams, grades and report cards", module: "7", ready: true }, // prettier-ignore
  { title: "Progress", href: "/progress", icon: TrendingUp, description: "Student progress dashboards", module: "7.4", ready: true }, // prettier-ignore
  { title: "Red Flags", href: "/red-flags", icon: TriangleAlert, description: "At-risk alerts and rules", module: "7.3", ready: true }, // prettier-ignore
  { title: "Fees", href: "/fees", icon: Wallet, description: "Invoices, payments and reminders", module: "6", ready: true }, // prettier-ignore
  { title: "Notifications", href: "/notifications", icon: Bell, description: "Alerts and messages", module: "4", ready: true }, // prettier-ignore
  { title: "Settings", href: "/settings", icon: Settings, description: "School profile and preferences", module: "1.6", ready: false }, // prettier-ignore
];
