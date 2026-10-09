# School Management SaaS

A multi-tenant school management platform: attendance, homework/diary, fees,
and a channel-agnostic notification engine (in-app, email, WhatsApp, web push),
built for schools in Pakistan.

> Status: **Module 6.2 complete - invoice generation + per-student ledger: a head generates a month's invoices for a class from the monthly fee structure (idempotent per student/month), views a filterable invoice list and each student's ledger; parents see their children's balances and ledgers.** Next: Module 6.3 - manual payment recording + bank-transfer verification. See the roadmap.

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
#   then set DATABASE_URL and APP_DATABASE_URL (and other values as modules come online)

# 3. Create the restricted app role (once per database; see Multi-tenancy below)
psql -d school -f prisma/sql/app-role.sql

# 4. Apply migrations to your database
npm run db:migrate

# 5. Run the dev server
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

| Script                | Purpose                                         |
| --------------------- | ----------------------------------------------- |
| `npm run db:migrate`  | Create/apply a dev migration                    |
| `npm run db:generate` | Regenerate the Prisma client                    |
| `npm run db:studio`   | Open Prisma Studio                              |
| `npm run db:deploy`   | Apply migrations (production)                   |
| `npm run db:reset`    | Drop, recreate, and re-migrate the database     |
| `npm run test:rls`    | Cross-tenant leak test (verifies RLS isolation) |

### Multi-tenancy (Module 1.5)

Tenant isolation is enforced by **PostgreSQL Row-Level Security**, not just app code.
Two database roles are used:

- **`DATABASE_URL`** - the owner role. Runs migrations, auth lookups, and
  SUPER_ADMIN operations. Bypasses RLS by design.
- **`APP_DATABASE_URL`** - a non-superuser role (`school_app`) the app uses for
  tenant data. RLS policies scope every row to the current school.

Tenant queries go through `withCurrentTenant()` / `withTenant()`
([`src/server/db/tenant.ts`](./src/server/db/tenant.ts)), which open a
transaction and set `app.current_school_id`; the policies key off it. With no
tenant context the restricted role sees **nothing** (fail-closed). Create the
role once with [`prisma/sql/app-role.sql`](./prisma/sql/app-role.sql), then run
`npm run test:rls` to confirm isolation holds.

Foreign keys bypass RLS, so tenant tables also use **composite foreign keys**:
parent tables carry `@@unique([schoolId, id])` and child references are
`(schoolId, parentId) -> parent(schoolId, id)`. PostgreSQL then rejects any
cross-tenant reference outright. Every new tenant table follows this pattern.

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
