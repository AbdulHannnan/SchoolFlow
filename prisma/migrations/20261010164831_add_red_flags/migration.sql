-- CreateEnum
CREATE TYPE "red_flag_type" AS ENUM ('ATTENDANCE_LOW', 'GRADES_LOW');

-- CreateEnum
CREATE TYPE "red_flag_status" AS ENUM ('OPEN', 'RESOLVED');

-- CreateTable
CREATE TABLE "red_flags" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "type" "red_flag_type" NOT NULL,
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "status" "red_flag_status" NOT NULL DEFAULT 'OPEN',
    "resolvedById" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "red_flags_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "red_flags_schoolId_idx" ON "red_flags"("schoolId");

-- CreateIndex
CREATE INDEX "red_flags_schoolId_status_idx" ON "red_flags"("schoolId", "status");

-- CreateIndex
CREATE INDEX "red_flags_studentId_idx" ON "red_flags"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "red_flags_studentId_key_key" ON "red_flags"("studentId", "key");

-- AddForeignKey
ALTER TABLE "red_flags" ADD CONSTRAINT "red_flags_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "red_flags" ADD CONSTRAINT "red_flags_schoolId_studentId_fkey" FOREIGN KEY ("schoolId", "studentId") REFERENCES "students"("schoolId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "red_flags" ADD CONSTRAINT "red_flags_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Row-Level Security (tenant isolation).
ALTER TABLE "red_flags" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "red_flags"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));
