/**
 * Cross-tenant leak test for Row-Level Security (Module 1.5).
 *
 * Seeds two schools (owner connection, which bypasses RLS), then proves that
 * the restricted `school_app` role — used via `withTenant` — can only ever see
 * and write its own school's rows. Exits non-zero if any assertion fails.
 *
 *   npm run test:rls
 *
 * Requires the restricted role to exist (prisma/sql/app-role.sql) and both
 * DATABASE_URL and APP_DATABASE_URL set (run with `node --env-file=.env`).
 */
import { prisma } from "../src/server/db/index.ts";
import { appPrisma, withTenant } from "../src/server/db/tenant.ts";

let failures = 0;

function check(label: string, pass: boolean, detail = "") {
  console.log(`${pass ? "✓ PASS" : "✗ FAIL"}  ${label}${detail ? `  — ${detail}` : ""}`);
  if (!pass) failures++;
}

async function main() {
  // --- Seed (owner role bypasses RLS) ------------------------------------
  await prisma.user.deleteMany({
    where: { email: { in: ["a@rls.test", "b@rls.test"] } },
  });
  await prisma.school.deleteMany({ where: { slug: { in: ["rls-test-a", "rls-test-b"] } } });

  const a = await prisma.school.create({ data: { name: "RLS Test A", slug: "rls-test-a" } });
  const b = await prisma.school.create({ data: { name: "RLS Test B", slug: "rls-test-b" } });
  await prisma.user.create({
    data: { schoolId: a.id, email: "a@rls.test", name: "User A", role: "HEAD", passwordHash: "x" },
  });
  await prisma.user.create({
    data: { schoolId: b.id, email: "b@rls.test", name: "User B", role: "HEAD", passwordHash: "x" },
  });

  // --- Read isolation ----------------------------------------------------
  const aUsers = await withTenant(a.id, (tx) => tx.user.findMany());
  check(
    "tenant A sees only its own users",
    aUsers.length === 1 && aUsers[0].email === "a@rls.test",
    `saw ${aUsers.map((u) => u.email).join(", ") || "none"}`,
  );

  const aSchools = await withTenant(a.id, (tx) => tx.school.findMany());
  check(
    "tenant A sees only its own school row",
    aSchools.length === 1 && aSchools[0].id === a.id,
    `saw ${aSchools.length} school(s)`,
  );

  const bUsers = await withTenant(b.id, (tx) => tx.user.findMany());
  check(
    "tenant B sees only its own users",
    bUsers.length === 1 && bUsers[0].email === "b@rls.test",
    `saw ${bUsers.map((u) => u.email).join(", ") || "none"}`,
  );

  // --- Fail-closed: no tenant context => no rows -------------------------
  const leaked = await appPrisma.user.findMany();
  check(
    "restricted role with NO tenant context sees nothing",
    leaked.length === 0,
    `saw ${leaked.length} row(s)`,
  );

  // --- Write isolation (WITH CHECK) --------------------------------------
  let blocked = false;
  try {
    await withTenant(a.id, (tx) =>
      tx.user.create({
        data: {
          schoolId: b.id,
          email: "evil@rls.test",
          name: "Evil",
          role: "HEAD",
          passwordHash: "x",
        },
      }),
    );
  } catch {
    blocked = true;
  }
  check("tenant A cannot insert a row for tenant B (WITH CHECK)", blocked);

  // Sanity: a legitimate same-tenant insert succeeds.
  let ownInsertOk = false;
  try {
    await withTenant(a.id, async (tx) => {
      await tx.user.create({
        data: {
          schoolId: a.id,
          email: "a2@rls.test",
          name: "User A2",
          role: "TEACHER",
          passwordHash: "x",
        },
      });
    });
    ownInsertOk = true;
  } catch (e) {
    ownInsertOk = false;
    console.error(e);
  }
  check("tenant A can insert a row for its own school", ownInsertOk);

  // --- Cleanup -----------------------------------------------------------
  await prisma.user.deleteMany({
    where: { email: { in: ["a@rls.test", "b@rls.test", "a2@rls.test", "evil@rls.test"] } },
  });
  await prisma.school.deleteMany({ where: { slug: { in: ["rls-test-a", "rls-test-b"] } } });

  await prisma.$disconnect();
  await appPrisma.$disconnect();

  console.log(failures === 0 ? "\nAll RLS checks passed." : `\n${failures} check(s) FAILED.`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
