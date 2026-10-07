# Roadmap

## Module 0 — Foundation

- [x] 0.1 Init Next.js + TypeScript repo, folder structure, ESLint/Prettier, .env.example, README
- [x] 0.2 Add PostgreSQL + Prisma, DB connection, base config, first migration runs clean
- [x] 0.3 Add Tailwind + shadcn/ui, a basic app shell/layout

## Module 1 — Multi-tenancy & Auth (the core — get this right)

- [x] 1.1 School (tenant) model + migration
- [x] 1.2 User model with roles, scoped by schoolId; password hashing
- [x] 1.3 Auth.js login/logout + session with role + schoolId
- [x] 1.4 Role-based access control middleware/guards
- [x] 1.5 Tenant-resolution middleware + PostgreSQL RLS policies (cross-tenant leak test)
- [x] 1.6 SUPER_ADMIN flow: create a school + its first HEAD account (tenant onboarding)

## Module 2 — Core School Data

- [x] 2.1 Classes & Sections
- [x] 2.2 Subjects
- [x] 2.3 Teacher CRUD + assign to classes/subjects
- [ ] 2.4 Student CRUD (linked to class/section)
- [ ] 2.5 Parent CRUD + link parent to one or more students

## Module 3 — Student Attendance

- [ ] 3.1 Attendance data model
- [ ] 3.2 Teacher UI: mark class attendance for a date
- [ ] 3.3 Attendance views for Head + Parent
- [ ] 3.4 Daily/weekly/monthly reports + CSV/PDF export

## Module 4 — Notification Engine (backbone for everything after)

- [ ] 4.1 Notification + Event abstraction (channel-agnostic), in-app channel
- [ ] 4.2 Email channel (Brevo) with templates
- [ ] 4.3 WhatsApp channel (Cloud API/BSP), utility templates, event-triggered only
- [ ] 4.4 Web Push (FCM)
- [ ] 4.5 Scheduler (node-cron) for batched/scheduled sends
- [ ] 4.6 Wire attendance "absent" event → WhatsApp alert to parent

## Module 5 — Homework / Daily Diary

- [ ] 5.1 Diary model
- [ ] 5.2 Teacher posts homework per class
- [ ] 5.3 Student/Parent views + notification hook

## Module 6 — Fees ← MVP ENDS HERE (ship to first school)

- [ ] 6.1 Fee structure (per class/category)
- [ ] 6.2 Invoice generation + per-student ledger
- [ ] 6.3 Manual payment recording + bank-transfer verification
- [ ] 6.4 Fee reminder events (via notification engine)
- [ ] 6.5 JazzCash integration
- [ ] 6.6 Easypaisa integration

## Module 7 — Progress, Exams & Red Flags (Phase 2)

- [ ] 7.1 Exam + grade model
- [ ] 7.2 Grade entry + report cards
- [ ] 7.3 Red-flag rules (attendance/grades thresholds) + alerts
- [ ] 7.4 Student progress dashboard

## Module 8 — Staff / Teacher Side (Phase 2)

- [ ] 8.1 Teacher (staff) attendance
- [ ] 8.2 Planner register
- [ ] 8.3 Meeting notifications to teachers

## Module 9 — Portals & Dashboards (Phase 2)

- [ ] 9.1 Head dashboard
- [ ] 9.2 Teacher portal
- [ ] 9.3 Parent portal
- [ ] 9.4 Student portal

## Module 10 — PWA, Localization & Deploy (Phase 2)

- [ ] 10.1 PWA (manifest, service worker, installable)
- [ ] 10.2 Urdu localization
- [ ] 10.3 VPS deploy (Docker + nginx + SSL + DB backups)
- [ ] 10.4 Academic year rollover / promotion to next class
