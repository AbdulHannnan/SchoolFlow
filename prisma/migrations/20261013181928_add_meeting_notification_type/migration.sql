-- Add the MEETING notification type (Module 8.3). Kept in its own migration,
-- sorting before add_meetings: an ALTER TYPE ... ADD VALUE must stand alone
-- (it cannot run in the same transaction that then uses the value, and PG
-- rejects it mixed with other statements in one tx block).
ALTER TYPE "notification_type" ADD VALUE 'MEETING';
