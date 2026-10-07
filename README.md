# School Management SaaS

A multi-tenant school management platform: attendance, homework/diary, fees,
and a channel-agnostic notification engine (in-app, email, WhatsApp, web push),
built for schools in Pakistan.

> Status: **Module 1.3 — Auth.js login/logout + session (role + schoolId).** Next: role-based access control guards (1.4). See the roadmap.

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

Requirements: Node.js 20+ and a PostgreSQL 14+ instance.

```bash
# 1. Install dependencies (also runs `prisma generate` via postinstall)
npm install

# 2. Configure environment
cp .env.example .env
#   then set DATABASE_URL (and other values as modules come online)

# 3. Apply migrations to your database
npm run db:migrate

# 4. Run the dev server
npm run dev
```

The app runs at http://localhost:3000.

**Local Postgres (macOS / Homebrew):**

```bash
brew install postgresql@17
brew services start postgresql@17
createdb school
```

The default `DATABASE_URL` in `.env.example` assumes this setup (trust auth, your
macOS user, no password).

### Database (Prisma 7)

Prisma 7 keeps the connection URL out of `schema.prisma`: the CLI reads it from
[`prisma.config.ts`](./prisma.config.ts) and the app connects at runtime through a
node-postgres driver adapter (see [`src/server/db`](./src/server/db)). Common tasks:

| Script                | Purpose                                     |
| --------------------- | ------------------------------------------- |
| `npm run db:migrate`  | Create/apply a dev migration                |
| `npm run db:generate` | Regenerate the Prisma client                |
| `npm run db:studio`   | Open Prisma Studio                          |
| `npm run db:deploy`   | Apply migrations (production)               |
| `npm run db:reset`    | Drop, recreate, and re-migrate the database |

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
