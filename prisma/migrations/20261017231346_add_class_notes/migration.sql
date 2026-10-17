-- CreateEnum
CREATE TYPE "class_note_type" AS ENUM ('HEAD_VISIT', 'GENERAL', 'ASSEMBLY', 'PARENT_COMMENT');

-- CreateTable
CREATE TABLE "class_notes" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "type" "class_note_type" NOT NULL DEFAULT 'GENERAL',
    "date" DATE NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "class_notes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "class_notes_schoolId_idx" ON "class_notes"("schoolId");

-- CreateIndex
CREATE INDEX "class_notes_classId_idx" ON "class_notes"("classId");

-- CreateIndex
CREATE INDEX "class_notes_schoolId_date_idx" ON "class_notes"("schoolId", "date");

-- AddForeignKey
ALTER TABLE "class_notes" ADD CONSTRAINT "class_notes_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_notes" ADD CONSTRAINT "class_notes_schoolId_classId_fkey" FOREIGN KEY ("schoolId", "classId") REFERENCES "classes"("schoolId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_notes" ADD CONSTRAINT "class_notes_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Row-Level Security (tenant isolation).
ALTER TABLE "class_notes" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "class_notes"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));
