-- AlterTable
ALTER TABLE "users" ADD COLUMN     "mainSubjectId" TEXT;

-- CreateIndex
CREATE INDEX "users_mainSubjectId_idx" ON "users"("mainSubjectId");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_mainSubjectId_fkey" FOREIGN KEY ("mainSubjectId") REFERENCES "subjects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
