-- AlterTable
ALTER TABLE "classes" ADD COLUMN     "hasSections" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "sections" ADD COLUMN     "sectionTeacherId" TEXT;

-- CreateIndex
CREATE INDEX "sections_sectionTeacherId_idx" ON "sections"("sectionTeacherId");

-- AddForeignKey
ALTER TABLE "sections" ADD CONSTRAINT "sections_sectionTeacherId_fkey" FOREIGN KEY ("sectionTeacherId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
