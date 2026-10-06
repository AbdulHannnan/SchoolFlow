import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

/**
 * Prisma client singleton.
 *
 * Prisma 7 connects through a driver adapter rather than a built-in engine,
 * so we construct a node-postgres adapter from DATABASE_URL and hand it to
 * PrismaClient.
 *
 * In development, Next.js hot-reloads modules on every edit, which would
 * otherwise create a new client (and connection pool) each time. We cache the
 * instance on `globalThis` to reuse a single client across reloads. In
 * production a fresh module graph is created once, so the cache is a no-op.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }

  const adapter = new PrismaPg({ connectionString });

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
