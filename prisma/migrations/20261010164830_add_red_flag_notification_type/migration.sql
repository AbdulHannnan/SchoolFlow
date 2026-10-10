-- AlterEnum
-- Standalone so the new value is committed before any migration or runtime code
-- uses it (Postgres won't let an added enum value be used in the same tx).
ALTER TYPE "notification_type" ADD VALUE 'RED_FLAG';
