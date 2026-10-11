-- AlterTable
ALTER TABLE "classes" ADD COLUMN     "classTeacherId" TEXT;

-- CreateIndex
CREATE INDEX "classes_classTeacherId_idx" ON "classes"("classTeacherId");

-- AddForeignKey
ALTER TABLE "classes" ADD CONSTRAINT "classes_classTeacherId_fkey" FOREIGN KEY ("classTeacherId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
