-- CreateTable
CREATE TABLE "subjects" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subjects_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "subjects_schoolId_idx" ON "subjects"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "subjects_schoolId_name_key" ON "subjects"("schoolId", "name");

-- AddForeignKey
ALTER TABLE "subjects" ADD CONSTRAINT "subjects_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Row-Level Security (tenant isolation).
ALTER TABLE "subjects" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "subjects"
  USING ("schoolId" = current_setting('app.current_school_id', true))
  WITH CHECK ("schoolId" = current_setting('app.current_school_id', true));
