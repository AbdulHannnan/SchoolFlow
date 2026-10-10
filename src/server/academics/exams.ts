import "server-only";

import type { ExamType, Prisma } from "@prisma/client";
import type { Session } from "next-auth";

import { requireSchool } from "@/server/auth/dal";
import { withTenant } from "@/server/db/tenant";
import { toDateOnly } from "@/server/academics/attendance";
import { letterGrade, percentage } from "@/lib/grades";

/**
 * Exams & grades (Module 7). A HEAD defines an exam for a class with its subject
 * papers (each with maximum/pass marks); a HEAD or an assigned TEACHER enters
 * each student's marks per paper; parents see a published exam's report card for
 * their child. Tenant-scoped: reads and writes use `withTenant` so RLS pins
 * every row to the acting school. Marks are fixed-scale decimals carried as
 * strings (like money), never floats.
 */

/** A HEAD may access any class; a TEACHER only classes they're assigned to. */
async function assertCanAccessClass(
  tx: Prisma.TransactionClient,
  user: Session["user"],
  classId: string,
): Promise<void> {
  if (user.role === "HEAD") return;
  if (user.role === "TEACHER") {
    const assignment = await tx.teacherAssignment.findFirst({
      where: { teacherId: user.id, classId },
      select: { id: true },
    });
    if (!assignment) throw new Error("You are not assigned to this class");
    return;
  }
  throw new Error("Not allowed to manage exams");
}

/**
 * Who may view one student's report card: HEAD (any student), PARENT (only a
 * linked child), TEACHER (only a student in a class they're assigned to). Runs
 * inside the tenant context so lookups never cross schools.
 */
async function assertCanViewStudent(
  tx: Prisma.TransactionClient,
  user: Session["user"],
  studentId: string,
): Promise<void> {
  if (user.role === "HEAD") return;
  if (user.role === "PARENT") {
    const link = await tx.parentStudent.findFirst({
      where: { parentId: user.id, studentId },
      select: { id: true },
    });
    if (!link) throw new Error("This student is not linked to your account");
    return;
  }
  if (user.role === "TEACHER") {
    const student = await tx.student.findFirst({
      where: { id: studentId, class: { teacherAssignments: { some: { teacherId: user.id } } } },
      select: { id: true },
    });
    if (!student) throw new Error("You are not assigned to this student's class");
    return;
  }
  throw new Error("Not allowed to view results");
}

export type CreateExamInput = {
  classId: string;
  name: string;
  type: ExamType;
  term: string | null;
  startDate: Date | null;
  subjects: { subjectId: string; maxMarks: string; passMarks: string | null }[];
};

/**
 * Create an exam for a class together with its subject papers (HEAD only). The
 * subject and class FK targets are re-checked in-tenant (RLS doesn't guard FK
 * targets). Returns the new exam id.
 */
export async function createExam(input: CreateExamInput) {
  const { schoolId } = await requireSchool();
  if (input.subjects.length === 0) throw new Error("Add at least one subject");

  const subjectIds = new Set<string>();
  for (const s of input.subjects) {
    if (subjectIds.has(s.subjectId)) throw new Error("A subject is listed more than once");
    subjectIds.add(s.subjectId);
  }
  const startDate = input.startDate ? toDateOnly(input.startDate) : null;

  return withTenant(schoolId, async (tx) => {
    const cls = await tx.class.findUnique({ where: { id: input.classId }, select: { id: true } });
    if (!cls) throw new Error("Class not found");

    const found = await tx.subject.findMany({
      where: { id: { in: [...subjectIds] } },
      select: { id: true },
    });
    if (found.length !== subjectIds.size) throw new Error("A selected subject was not found");

    const exam = await tx.exam.create({
      data: {
        schoolId,
        classId: input.classId,
        name: input.name,
        type: input.type,
        term: input.term,
        startDate,
      },
      select: { id: true },
    });
    await tx.examSubject.createMany({
      data: input.subjects.map((s) => ({
        schoolId,
        examId: exam.id,
        subjectId: s.subjectId,
        maxMarks: s.maxMarks,
        passMarks: s.passMarks,
      })),
    });
    return { id: exam.id };
  });
}

/** Exams for a class, newest first (HEAD any / TEACHER assigned). */
export async function listExams(classId: string) {
  const { user, schoolId } = await requireSchool();
  return withTenant(schoolId, async (tx) => {
    const cls = await tx.class.findUnique({
      where: { id: classId },
      select: { id: true, name: true },
    });
    if (!cls) throw new Error("Class not found");
    await assertCanAccessClass(tx, user, classId);

    const exams = await tx.exam.findMany({
      where: { classId },
      orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        name: true,
        type: true,
        term: true,
        startDate: true,
        isPublished: true,
        _count: { select: { subjects: true } },
      },
    });

    return {
      class: cls,
      exams: exams.map((e) => ({
        id: e.id,
        name: e.name,
        type: e.type,
        term: e.term,
        startDate: e.startDate,
        isPublished: e.isPublished,
        paperCount: e._count.subjects,
      })),
    };
  });
}

/** Exam header + its papers (with how many results are entered) for the detail page. */
export async function getExamOverview(examId: string) {
  const { user, schoolId } = await requireSchool();
  return withTenant(schoolId, async (tx) => {
    const exam = await tx.exam.findUnique({
      where: { id: examId },
      select: {
        id: true,
        name: true,
        type: true,
        term: true,
        startDate: true,
        isPublished: true,
        classId: true,
        class: { select: { name: true } },
        subjects: {
          orderBy: { subject: { name: "asc" } },
          select: {
            id: true,
            maxMarks: true,
            passMarks: true,
            subject: { select: { name: true } },
            _count: { select: { results: true } },
          },
        },
      },
    });
    if (!exam) throw new Error("Exam not found");
    await assertCanAccessClass(tx, user, exam.classId);

    const studentCount = await tx.student.count({
      where: { classId: exam.classId, isActive: true },
    });

    return {
      exam: {
        id: exam.id,
        name: exam.name,
        type: exam.type,
        term: exam.term,
        startDate: exam.startDate,
        isPublished: exam.isPublished,
        classId: exam.classId,
        className: exam.class.name,
      },
      studentCount,
      papers: exam.subjects.map((p) => ({
        id: p.id,
        subjectName: p.subject.name,
        maxMarks: p.maxMarks.toString(),
        passMarks: p.passMarks ? p.passMarks.toString() : null,
        entered: p._count.results,
      })),
    };
  });
}

/** Active students of an exam's class (HEAD any / TEACHER assigned). */
export async function listExamStudents(examId: string) {
  const { user, schoolId } = await requireSchool();
  return withTenant(schoolId, async (tx) => {
    const exam = await tx.exam.findUnique({ where: { id: examId }, select: { classId: true } });
    if (!exam) throw new Error("Exam not found");
    await assertCanAccessClass(tx, user, exam.classId);

    return tx.student.findMany({
      where: { classId: exam.classId, isActive: true },
      orderBy: [{ rollNumber: "asc" }, { name: "asc" }],
      select: { id: true, name: true, rollNumber: true, section: { select: { name: true } } },
    });
  });
}

/** One paper's roster for mark entry: each active student with their current result. */
export async function getPaperForEntry(examSubjectId: string) {
  const { user, schoolId } = await requireSchool();
  return withTenant(schoolId, async (tx) => {
    const paper = await tx.examSubject.findUnique({
      where: { id: examSubjectId },
      select: {
        id: true,
        maxMarks: true,
        passMarks: true,
        subject: { select: { name: true } },
        exam: {
          select: { id: true, name: true, classId: true, class: { select: { name: true } } },
        },
      },
    });
    if (!paper) throw new Error("Exam paper not found");
    await assertCanAccessClass(tx, user, paper.exam.classId);

    const students = await tx.student.findMany({
      where: { classId: paper.exam.classId, isActive: true },
      orderBy: [{ rollNumber: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        rollNumber: true,
        section: { select: { name: true } },
        examResults: {
          where: { examSubjectId },
          select: { marksObtained: true, isAbsent: true },
          take: 1,
        },
      },
    });

    return {
      paper: {
        id: paper.id,
        subjectName: paper.subject.name,
        maxMarks: paper.maxMarks.toString(),
        passMarks: paper.passMarks ? paper.passMarks.toString() : null,
        examId: paper.exam.id,
        examName: paper.exam.name,
        className: paper.exam.class.name,
      },
      roster: students.map((s) => {
        const r = s.examResults[0] ?? null;
        return {
          studentId: s.id,
          name: s.name,
          rollNumber: s.rollNumber,
          section: s.section,
          marksObtained: r?.marksObtained ? r.marksObtained.toString() : "",
          isAbsent: r?.isAbsent ?? false,
        };
      }),
    };
  });
}

export type ResultEntry = { studentId: string; marks: string | null; isAbsent: boolean };

/**
 * Record (or overwrite) one paper's results (HEAD / assigned TEACHER). Idempotent
 * per student via the `(examSubjectId, studentId)` unique key. Students not in
 * the exam's class are rejected, and marks must be within [0, maxMarks]; an
 * absent student's marks are cleared. Returns how many rows were saved.
 */
export async function savePaperResults(input: { examSubjectId: string; entries: ResultEntry[] }) {
  const { user, schoolId } = await requireSchool();
  return withTenant(schoolId, async (tx) => {
    const paper = await tx.examSubject.findUnique({
      where: { id: input.examSubjectId },
      select: { id: true, maxMarks: true, exam: { select: { classId: true } } },
    });
    if (!paper) throw new Error("Exam paper not found");
    await assertCanAccessClass(tx, user, paper.exam.classId);

    const max = Number(paper.maxMarks);
    const students = await tx.student.findMany({
      where: { classId: paper.exam.classId },
      select: { id: true },
    });
    const valid = new Set(students.map((s) => s.id));

    let saved = 0;
    for (const entry of input.entries) {
      if (!valid.has(entry.studentId)) {
        throw new Error("A student does not belong to this class");
      }
      let marks: string | null = null;
      if (!entry.isAbsent && entry.marks !== null && entry.marks !== "") {
        const n = Number(entry.marks);
        if (!Number.isFinite(n) || n < 0) throw new Error("Marks must be zero or more");
        if (n > max) throw new Error(`Marks cannot exceed the maximum of ${max}`);
        marks = entry.marks;
      }
      await tx.examResult.upsert({
        where: {
          examSubjectId_studentId: {
            examSubjectId: input.examSubjectId,
            studentId: entry.studentId,
          },
        },
        create: {
          schoolId,
          examSubjectId: input.examSubjectId,
          studentId: entry.studentId,
          marksObtained: marks,
          isAbsent: entry.isAbsent,
          recordedById: user.id,
        },
        update: {
          marksObtained: marks,
          isAbsent: entry.isAbsent,
          recordedById: user.id,
        },
      });
      saved += 1;
    }

    return { saved };
  });
}

/** Publish or unpublish an exam's results to parents/students (HEAD). */
export async function setExamPublished(examId: string, isPublished: boolean): Promise<void> {
  const { schoolId } = await requireSchool();
  await withTenant(schoolId, (tx) =>
    tx.exam.updateMany({ where: { id: examId }, data: { isPublished } }),
  );
}

/** Delete an exam (HEAD); its papers and results cascade. */
export async function deleteExam(examId: string): Promise<void> {
  const { schoolId } = await requireSchool();
  await withTenant(schoolId, (tx) => tx.exam.deleteMany({ where: { id: examId } }));
}

export type ReportCardRow = {
  examSubjectId: string;
  subjectName: string;
  maxMarks: string;
  passMarks: string | null;
  marksObtained: string | null;
  isAbsent: boolean;
  percentage: number | null;
  grade: string | null;
  passed: boolean | null;
};

/**
 * One student's report card for an exam: a row per subject with marks, percent,
 * letter grade and pass/fail, plus overall totals. HEAD any student, TEACHER an
 * assigned student, PARENT only a linked child and only once the exam is
 * published. Marks are returned as strings; percentages are computed as numbers.
 */
export async function getReportCard(examId: string, studentId: string) {
  const { user, schoolId } = await requireSchool();
  return withTenant(schoolId, async (tx) => {
    const exam = await tx.exam.findUnique({
      where: { id: examId },
      select: {
        id: true,
        name: true,
        type: true,
        term: true,
        startDate: true,
        isPublished: true,
        classId: true,
        class: { select: { name: true } },
      },
    });
    if (!exam) throw new Error("Exam not found");
    await assertCanViewStudent(tx, user, studentId);
    if (user.role === "PARENT" && !exam.isPublished) {
      throw new Error("This report card is not available yet");
    }

    const student = await tx.student.findUnique({
      where: { id: studentId },
      select: {
        id: true,
        name: true,
        rollNumber: true,
        class: { select: { name: true } },
        section: { select: { name: true } },
      },
    });
    if (!student) throw new Error("Student not found");

    const papers = await tx.examSubject.findMany({
      where: { examId },
      orderBy: { subject: { name: "asc" } },
      select: {
        id: true,
        maxMarks: true,
        passMarks: true,
        subject: { select: { name: true } },
        results: { where: { studentId }, select: { marksObtained: true, isAbsent: true }, take: 1 },
      },
    });

    let totalObtained = 0;
    let totalMax = 0;
    let anyMarks = false;

    const rows: ReportCardRow[] = papers.map((p) => {
      const r = p.results[0] ?? null;
      const max = Number(p.maxMarks);
      const isAbsent = r?.isAbsent ?? false;
      const obtainedStr =
        r && r.marksObtained !== null ? (r.marksObtained?.toString() ?? null) : null;
      const obtained = obtainedStr !== null ? Number(obtainedStr) : null;

      let pct: number | null = null;
      let grade: string | null = null;
      let passed: boolean | null = null;

      if (!isAbsent && obtained !== null) {
        anyMarks = true;
        totalObtained += obtained;
        totalMax += max;
        pct = percentage(obtained, max);
        grade = pct !== null ? letterGrade(pct) : null;
        passed = p.passMarks !== null ? obtained >= Number(p.passMarks) : null;
      } else if (isAbsent && p.passMarks !== null) {
        passed = false;
      }

      return {
        examSubjectId: p.id,
        subjectName: p.subject.name,
        maxMarks: p.maxMarks.toString(),
        passMarks: p.passMarks ? p.passMarks.toString() : null,
        marksObtained: obtainedStr,
        isAbsent,
        percentage: pct,
        grade,
        passed,
      };
    });

    const overallPct = anyMarks ? percentage(totalObtained, totalMax) : null;

    return {
      exam: {
        id: exam.id,
        name: exam.name,
        type: exam.type,
        term: exam.term,
        startDate: exam.startDate,
        isPublished: exam.isPublished,
        className: exam.class.name,
      },
      student,
      rows,
      totals: {
        obtained: anyMarks ? String(totalObtained) : null,
        max: anyMarks ? String(totalMax) : null,
        percentage: overallPct,
        grade: overallPct !== null ? letterGrade(overallPct) : null,
      },
    };
  });
}

/** The signed-in parent's children, each with their class's published exams. */
export async function listChildrenExams() {
  const { user, schoolId } = await requireSchool();
  return withTenant(schoolId, async (tx) => {
    const links = await tx.parentStudent.findMany({
      where: { parentId: user.id },
      orderBy: { createdAt: "asc" },
      select: {
        student: {
          select: {
            id: true,
            name: true,
            classId: true,
            class: { select: { name: true } },
            section: { select: { name: true } },
          },
        },
      },
    });

    const children = [];
    for (const { student } of links) {
      const exams = await tx.exam.findMany({
        where: { classId: student.classId, isPublished: true },
        orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
        select: { id: true, name: true, type: true, term: true, startDate: true },
      });
      children.push({ student, exams });
    }

    return { children };
  });
}
