-- AlterEnum
ALTER TYPE "notification_type" ADD VALUE 'HOMEWORK_POSTED';

-- CreateEnum
CREATE TYPE "diary_type" AS ENUM ('HOMEWORK', 'NOTE');

-- CreateTable
CREATE TABLE "diary_entries" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "sectionId" TEXT,
    "subjectId" TEXT,
    "type" "diary_type" NOT NULL DEFAULT 'HOMEWORK',
    "date" DATE NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "dueDate" DATE,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "diary_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "diary_entries_schoolId_idx" ON "diary_entries"("schoolId");

-- CreateIndex
CREATE INDEX "diary_entries_classId_date_idx" ON "diary_entries"("classId", "date");

-- CreateIndex
CREATE INDEX "diary_entries_schoolId_date_idx" ON "diary_entries"("schoolId", "date");

-- AddForeignKey
ALTER TABLE "diary_entries" ADD CONSTRAINT "diary_entries_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diary_entries" ADD CONSTRAINT "diary_entries_schoolId_classId_fkey" FOREIGN KEY ("schoolId", "classId") REFERENCES "classes"("schoolId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diary_entries" ADD CONSTRAINT "diary_entries_schoolId_sectionId_fkey" FOREIGN KEY ("schoolId", "sectionId") REFERENCES "sections"("schoolId", "id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diary_entries" ADD CONSTRAINT "diary_entries_schoolId_subjectId_fkey" FOREIGN KEY ("schoolId", "subjectId") REFERENCES "subjects"("schoolId", "id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diary_entries" ADD CONSTRAINT "diary_entries_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Row-Level Security (tenant isolation).
ALTER TABLE "diary_entries" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "diary_entries"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));
