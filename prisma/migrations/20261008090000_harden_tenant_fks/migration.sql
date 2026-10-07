-- Tenant-integrity hardening (Module 2.3 follow-up).
-- Composite (schoolId, id) uniques + composite foreign keys so PostgreSQL
-- rejects any FK that points at a row in a different school. This closes the
-- gap where plain FK checks bypass RLS.

-- Composite unique keys on the FK target tables.
CREATE UNIQUE INDEX "users_schoolId_id_key" ON "users"("schoolId", "id");
CREATE UNIQUE INDEX "classes_schoolId_id_key" ON "classes"("schoolId", "id");
CREATE UNIQUE INDEX "sections_schoolId_id_key" ON "sections"("schoolId", "id");
CREATE UNIQUE INDEX "subjects_schoolId_id_key" ON "subjects"("schoolId", "id");

-- sections.class: single-column FK -> composite (schoolId, classId).
ALTER TABLE "sections" DROP CONSTRAINT "sections_classId_fkey";
ALTER TABLE "sections" ADD CONSTRAINT "sections_schoolId_classId_fkey"
  FOREIGN KEY ("schoolId", "classId") REFERENCES "classes"("schoolId", "id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- teacher_assignments: all three refs become composite.
ALTER TABLE "teacher_assignments" DROP CONSTRAINT "teacher_assignments_teacherId_fkey";
ALTER TABLE "teacher_assignments" DROP CONSTRAINT "teacher_assignments_subjectId_fkey";
ALTER TABLE "teacher_assignments" DROP CONSTRAINT "teacher_assignments_classId_fkey";

ALTER TABLE "teacher_assignments" ADD CONSTRAINT "teacher_assignments_schoolId_teacherId_fkey"
  FOREIGN KEY ("schoolId", "teacherId") REFERENCES "users"("schoolId", "id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "teacher_assignments" ADD CONSTRAINT "teacher_assignments_schoolId_subjectId_fkey"
  FOREIGN KEY ("schoolId", "subjectId") REFERENCES "subjects"("schoolId", "id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "teacher_assignments" ADD CONSTRAINT "teacher_assignments_schoolId_classId_fkey"
  FOREIGN KEY ("schoolId", "classId") REFERENCES "classes"("schoolId", "id")
  ON DELETE CASCADE ON UPDATE CASCADE;
