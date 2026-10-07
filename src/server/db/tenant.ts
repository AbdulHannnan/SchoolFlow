import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type Prisma } from "@prisma/client";

/**
 * Tenant-scoped database access (Module 1.5).
 *
 * `appPrisma` connects as the restricted `school_app` role (APP_DATABASE_URL),
 * which is subject to Row-Level Security. Never query it directly for tenant
 * data - go through `withTenant`, which opens a transaction and sets
 * `app.current_school_id` so the RLS policies scope every row to that school.
 *
 * Without the setting the policies match no rows (fail-closed), so a stray
 * query on `appPrisma` returns nothing rather than leaking across tenants.
 */
const globalForAppPrisma = globalThis as unknown as {
  appPrisma: PrismaClient | undefined;
};

function createAppPrismaClient() {
  const connectionString = process.env.APP_DATABASE_URL;
  if (!connectionString) {
    throw new Error("APP_DATABASE_URL is not set");
  }

  const adapter = new PrismaPg({ connectionString });

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

export const appPrisma = globalForAppPrisma.appPrisma ?? createAppPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForAppPrisma.appPrisma = appPrisma;
}

/**
 * Run `fn` bound to one school's RLS context. All queries made with the
 * provided transaction client see and write only rows for `schoolId`.
 *
 *   await withTenant(schoolId, (tx) => tx.user.findMany());
 */
export async function withTenant<T>(
  schoolId: string,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return appPrisma.$transaction(async (tx) => {
    // `true` = set only for this transaction; parameterized to avoid injection.
    await tx.$executeRaw`SELECT set_config('app.current_school_id', ${schoolId}, true)`;
    return fn(tx);
  });
}
