# School Management SaaS

A multi-tenant school management platform: attendance, homework/diary, fees,
and a channel-agnostic notification engine (in-app, email, WhatsApp, web push),
built for schools in Pakistan.

> Status: **Module 0.1 — project foundation.** See the roadmap for what's next.

## Tech stack

| Concern         | Choice                                             |
| --------------- | -------------------------------------------------- |
| Framework       | Next.js 16 (App Router) + React 19                 |
| Language        | TypeScript                                         |
| Database        | PostgreSQL + Prisma _(Module 0.2)_                 |
| Styling / UI    | Tailwind CSS + shadcn/ui _(Module 0.3)_            |
| Auth            | Auth.js (v5) _(Module 1.3)_                        |
| Multi-tenancy   | `schoolId` scoping + PostgreSQL RLS _(Module 1.5)_ |
| Notifications   | In-app, Brevo email, WhatsApp Cloud API, FCM       |
| Scheduling      | node-cron _(Module 4.5)_                           |
| Package manager | npm                                                |

## Getting started

Requirements: Node.js 20+ and (from Module 0.2) a PostgreSQL instance.

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
#   then fill in the values

# 3. Run the dev server
npm run dev
```

The app runs at http://localhost:3000.

## Scripts

| Script                 | Purpose                          |
| ---------------------- | -------------------------------- |
| `npm run dev`          | Start the dev server             |
| `npm run build`        | Production build                 |
| `npm run start`        | Serve the production build       |
| `npm run lint`         | Lint with ESLint                 |
| `npm run lint:fix`     | Lint and auto-fix                |
| `npm run format`       | Format with Prettier             |
| `npm run format:check` | Check formatting without writing |
| `npm run type-check`   | Type-check with `tsc --noEmit`   |

## Project structure

```
src/
  app/              Next.js App Router routes, layouts, pages
  components/       Shared React components
    ui/             shadcn/ui primitives (added in Module 0.3)
  config/           App configuration and constants
  lib/              Isomorphic helpers (safe on client and server)
  server/           Server-only code (never imported by the client)
    auth/           Auth.js setup, session, RBAC guards
    db/             Prisma client and data-access helpers
  types/            Shared TypeScript types
```

## Roadmap

The full module-by-module roadmap lives in [`ROADMAP.md`](./ROADMAP.md).
The MVP ships at the end of Module 6 (Fees).
