import "dotenv/config";
import { defineConfig, env } from "prisma/config";

/**
 * Prisma CLI configuration (Prisma 7).
 *
 * The datasource URL moved out of schema.prisma and lives here for CLI
 * commands (migrate, studio, db). `.env` is NOT auto-loaded by Prisma 7,
 * hence the `dotenv/config` import above. At runtime the connection is
 * supplied to PrismaClient via a driver adapter - see src/server/db.
 */
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
