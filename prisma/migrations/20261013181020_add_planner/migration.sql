-- CreateEnum
CREATE TYPE "planner_status" AS ENUM ('PLANNED', 'COMPLETED');

-- CreateTable
CREATE TABLE "planner_entries" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "topic" TEXT NOT NULL,
    "details" TEXT NOT NULL,
    "homework" TEXT,
    "status" "planner_status" NOT NULL DEFAULT 'PLANNED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "planner_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "planner_entries_schoolId_idx" ON "planner_entries"("schoolId");

-- CreateIndex
CREATE INDEX "planner_entries_teacherId_idx" ON "planner_entries"("teacherId");

-- CreateIndex
CREATE INDEX "planner_entries_classId_idx" ON "planner_entries"("classId");

-- CreateIndex
CREATE INDEX "planner_entries_schoolId_date_idx" ON "planner_entries"("schoolId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "planner_entries_teacherId_classId_subjectId_date_key" ON "planner_entries"("teacherId", "classId", "subjectId", "date");

-- AddForeignKey
ALTER TABLE "planner_entries" ADD CONSTRAINT "planner_entries_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planner_entries" ADD CONSTRAINT "planner_entries_schoolId_teacherId_fkey" FOREIGN KEY ("schoolId", "teacherId") REFERENCES "users"("schoolId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planner_entries" ADD CONSTRAINT "planner_entries_schoolId_classId_fkey" FOREIGN KEY ("schoolId", "classId") REFERENCES "classes"("schoolId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planner_entries" ADD CONSTRAINT "planner_entries_schoolId_subjectId_fkey" FOREIGN KEY ("schoolId", "subjectId") REFERENCES "subjects"("schoolId", "id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- Row-Level Security (tenant isolation).
ALTER TABLE "planner_entries" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "planner_entries"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));
