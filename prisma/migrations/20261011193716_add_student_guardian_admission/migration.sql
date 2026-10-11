-- AlterTable
ALTER TABLE "students" ADD COLUMN     "admissionDate" DATE,
ADD COLUMN     "fatherCnic" TEXT,
ADD COLUMN     "fatherName" TEXT,
ALTER COLUMN "dateOfBirth" SET DATA TYPE DATE;
