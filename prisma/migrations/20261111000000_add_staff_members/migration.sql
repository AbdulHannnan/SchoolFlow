-- CreateEnum
CREATE TYPE "support_staff_role" AS ENUM ('DRIVER', 'GARDENER', 'MAID', 'CLERK', 'GUARD', 'COOK', 'SWEEPER', 'PEON', 'ACCOUNTANT', 'OTHER');

-- CreateTable
CREATE TABLE "staff_members" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "support_staff_role" NOT NULL,
    "customRole" TEXT,
    "phone" TEXT,
    "cnic" TEXT,
    "address" TEXT,
    "joiningDate" DATE,
    "monthlySalary" DECIMAL(10,2),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_members_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "staff_members_schoolId_idx" ON "staff_members"("schoolId");

-- AddForeignKey
ALTER TABLE "staff_members" ADD CONSTRAINT "staff_members_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Row-Level Security (tenant isolation).
ALTER TABLE "staff_members" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "staff_members"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));
