-- AlterEnum
-- Weekly student report a HEAD sends to parents over WhatsApp (and in-app).
-- Standalone so the new value is committed before any migration or runtime
-- code uses it (Postgres won't let an added enum value be used in the same tx).
ALTER TYPE "notification_type" ADD VALUE 'WEEKLY_REPORT';
