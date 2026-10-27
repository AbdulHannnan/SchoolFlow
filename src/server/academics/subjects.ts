import "server-only";

import { requireSchool, withCurrentTenant } from "@/server/auth/dal";
import { withTenant } from "@/server/db/tenant";

/** Subjects data access (Module 2.2). Tenant-scoped; roles enforced in actions. */

export function listSubjects() {
  return withCurrentTenant((tx) => tx.subject.findMany({ orderBy: { name: "asc" } }));
}

export type MySubjectGroup = {
  subjectId: string;
  subjectName: string;
  code: string | null;
  classes: { id: string; name: string; level: number | null }[];
};

/**
 * The signed-in teacher's subjects, grouped - each subject with the classes
 * they're assigned to teach it in. Derived from their `teacherAssignment` rows,
 * the same source the rest of the teacher scope uses.
 */
export async function listMySubjects(): Promise<MySubjectGroup[]> {
  const { user, schoolId } = await requireSchool();
  return withTenant(schoolId, async (tx) => {
    const rows = await tx.teacherAssignment.findMany({
      where: { teacherId: user.id },
      orderBy: [{ subject: { name: "asc" } }, { class: { level: "asc" } }, { class: { name: "asc" } }],
      select: {
        subjectId: true,
        subject: { select: { name: true, code: true } },
        class: { select: { id: true, name: true, level: true } },
      },
    });

    const bySubject = new Map<string, MySubjectGroup>();
    for (const r of rows) {
      let group = bySubject.get(r.subjectId);
      if (!group) {
        group = {
          subjectId: r.subjectId,
          subjectName: r.subject.name,
          code: r.subject.code,
          classes: [],
        };
        bySubject.set(r.subjectId, group);
      }
      group.classes.push({ id: r.class.id, name: r.class.name, level: r.class.level });
    }
    return [...bySubject.values()];
  });
}

export async function createSubject(input: { name: string; code: string | null }) {
  const { schoolId } = await requireSchool();
  return withTenant(schoolId, (tx) =>
    tx.subject.create({ data: { schoolId, name: input.name, code: input.code } }),
  );
}

export async function deleteSubject(id: string) {
  const { schoolId } = await requireSchool();
  return withTenant(schoolId, (tx) => tx.subject.delete({ where: { id } }));
}
