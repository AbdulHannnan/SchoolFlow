-- Restricted application database role (Module 1.5).
--
-- Run ONCE per database, as a superuser/owner, BEFORE migrations:
--   psql -d school -f prisma/sql/app-role.sql
--
-- The app connects as this NON-superuser, NON-owner role at runtime
-- (APP_DATABASE_URL) so PostgreSQL Row-Level Security actually applies — a
-- superuser (and the table owner) would otherwise bypass RLS. Migrations,
-- auth lookups, and SUPER_ADMIN operations keep using the owner role
-- (DATABASE_URL), which bypasses RLS by design.
--
-- Idempotent: safe to re-run.

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'school_app') THEN
    CREATE ROLE school_app LOGIN PASSWORD 'school_app'
      NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
  END IF;
END
$$;

-- Access to existing objects.
GRANT USAGE ON SCHEMA public TO school_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO school_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO school_app;

-- Access to objects CREATED LATER by the owner (future migrations' tables),
-- so new tenant tables are reachable without re-granting each time. RLS still
-- governs which ROWS are visible.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO school_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO school_app;
