-- Row-Level Security for tenant isolation (Module 1.5).
--
-- Each tenant-scoped query runs through `withTenant()` (src/server/db/tenant.ts),
-- which sets `app.current_school_id` for the transaction. The policies below
-- restrict visible/writable rows to that school. When the setting is absent,
-- `current_setting('app.current_school_id', true)` returns NULL and every row
-- comparison is NULL (excluded) — so the restricted role sees nothing by
-- default (fail-closed).
--
-- Enforcement relies on the app connecting as the non-superuser `school_app`
-- role (APP_DATABASE_URL); the owner role bypasses RLS by design.

-- schools: a tenant may only see/modify its own row.
ALTER TABLE "schools" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON "schools"
  USING ("id" = current_setting('app.current_school_id', true))
  WITH CHECK ("id" = current_setting('app.current_school_id', true));

-- users: a tenant may only see/modify users belonging to its school.
-- (SUPER_ADMIN rows have schoolId = NULL and are managed via the owner role.)
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON "users"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));
