-- AlterEnum
-- Manual conduct flag a teacher can raise against a student (Module 7.3).
-- Standalone so the new value is committed before any migration or runtime
-- code uses it (Postgres won't let an added enum value be used in the same tx).
ALTER TYPE "red_flag_type" ADD VALUE 'BEHAVIOR';
