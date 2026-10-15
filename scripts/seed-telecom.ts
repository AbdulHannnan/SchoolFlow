/**
 * Realistic single-school seed: "Telecom Foundation".
 *
 * Builds one fully populated tenant for local testing/demo:
 *   - 1 HEAD + 10 TEACHERS
 *   - Classes: Prep 1, Prep 2, Class 1 ... Class 8 (sections A/B)
 *   - 15-20 students per class, grouped into families (so some are siblings),
 *     each family with a linked PARENT account
 *   - Subjects + per-class teacher assignments (each teacher has a main subject)
 *   - ~2 weeks of student attendance
 *   - Planner (lesson-plan) entries for recent days
 *   - Fee categories/structures + current-month invoices (paid / partial / unpaid)
 *   - A published Mid-Term Examination per class with marks for every student
 *
 * Idempotent: wipes the "tf" school first, then rebuilds. Runs on the OWNER
 * connection (bypasses RLS), like the onboarding flow and the demo seed.
 *
 *   node --env-file=.env scripts/seed-telecom.ts
 *
 * All accounts use the password: password
 */
import { prisma } from "../src/server/db/index.ts";
import { hashPassword } from "../src/server/auth/password.ts";
import type { AttendanceStatus, Gender } from "@prisma/client";

const SLUG = "tf";
const PASSWORD = "password";

// --- Deterministic RNG so reruns produce the same data --------------------
let _seed = 1337;
function rng(): number {
  // mulberry32
  _seed |= 0;
  _seed = (_seed + 0x6d2b79f5) | 0;
  let t = Math.imul(_seed ^ (_seed >>> 15), 1 | _seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
function randInt(min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}
function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}
function chance(p: number): boolean {
  return rng() < p;
}

/** UTC midnight, `daysAgo` days before today. */
function dayUTC(daysAgo: number): Date {
  const now = new Date();
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d;
}
/** The last `count` school days (skipping Sundays), oldest first. */
function recentSchoolDays(count: number): Date[] {
  const out: Date[] = [];
  let back = 1;
  while (out.length < count && back < count * 3) {
    const d = dayUTC(back);
    if (d.getUTCDay() !== 0) out.push(d); // skip Sunday
    back++;
  }
  return out.reverse();
}

async function chunked<T>(items: T[], size: number, fn: (item: T) => Promise<unknown>) {
  for (let i = 0; i < items.length; i += size) {
    await Promise.all(items.slice(i, i + size).map(fn));
  }
}

// --- Name pools ------------------------------------------------------------
const MALE_FIRST = [
  "Ahmed", "Ali", "Hassan", "Hussain", "Bilal", "Usman", "Omar", "Hamza", "Saad", "Zain",
  "Faizan", "Talha", "Daniyal", "Ibrahim", "Abdullah", "Rehan", "Shahzaib", "Arsalan", "Fahad", "Haris",
] as const;
const FEMALE_FIRST = [
  "Ayesha", "Fatima", "Zainab", "Maryam", "Hira", "Sana", "Noor", "Aiman", "Mahnoor", "Iqra",
  "Rabia", "Amna", "Laiba", "Eman", "Dua", "Areeba", "Sidra", "Komal", "Mehwish", "Warda",
] as const;
const SURNAMES = [
  "Khan", "Malik", "Raza", "Sheikh", "Ahmed", "Butt", "Chaudhry", "Qureshi", "Siddiqui", "Hashmi",
  "Baig", "Farooqi", "Awan", "Gondal", "Dar", "Kiani", "Abbasi", "Mughal", "Rana", "Cheema",
  "Zafar", "Nawaz", "Iqbal", "Javed", "Aslam", "Bhatti", "Memon", "Shah", "Jutt", "Lodhi",
] as const;

const TEACHER_NAMES = [
  "Mr. Imran Qadri", "Ms. Saima Yousuf", "Mr. Tariq Mehmood", "Ms. Nadia Aslam",
  "Mr. Kamran Shah", "Ms. Farah Deen", "Mr. Waqas Ahmed", "Ms. Hina Pervaiz",
  "Mr. Asif Nawaz", "Ms. Rukhsana Bibi",
] as const;

const ALL_SUBJECTS = [
  { name: "English", code: "ENG" },
  { name: "Urdu", code: "URD" },
  { name: "Mathematics", code: "MATH" },
  { name: "Science", code: "SCI" },
  { name: "Social Studies", code: "SST" },
  { name: "Islamiat", code: "ISL" },
  { name: "Computer Science", code: "CS" },
  { name: "Art", code: "ART" },
] as const;

// Prep classes take a lighter subject load.
const PREP_SUBJECTS = ["English", "Urdu", "Mathematics", "Islamiat", "Art"];

const CLASSES = [
  { name: "Prep 1", level: 1, prep: true, age: 4 },
  { name: "Prep 2", level: 2, prep: true, age: 5 },
  { name: "Class 1", level: 3, prep: false, age: 6 },
  { name: "Class 2", level: 4, prep: false, age: 7 },
  { name: "Class 3", level: 5, prep: false, age: 8 },
  { name: "Class 4", level: 6, prep: false, age: 9 },
  { name: "Class 5", level: 7, prep: false, age: 10 },
  { name: "Class 6", level: 8, prep: false, age: 11 },
  { name: "Class 7", level: 9, prep: false, age: 12 },
  { name: "Class 8", level: 10, prep: false, age: 13 },
] as const;

function monthPeriod(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}
function monthLabel(d: Date): string {
  return d.toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
}

async function main() {
  console.log("Seeding 'Telecom Foundation' ...");

  // --- Clean previous run -------------------------------------------------
  await prisma.school.deleteMany({ where: { slug: SLUG } });

  const hash = await hashPassword(PASSWORD);

  // --- School -------------------------------------------------------------
  const school = await prisma.school.create({
    data: {
      name: "Telecom Foundation",
      slug: SLUG,
      email: "info@telecomfoundation.edu.pk",
      phone: "924235880000",
      address: "Block C, Model Town, Lahore",
    },
  });
  const sid = school.id;

  // --- Head ---------------------------------------------------------------
  const head = await prisma.user.create({
    data: {
      schoolId: sid,
      email: "head@tf.test",
      name: "Principal Shahid Mahmood",
      role: "HEAD",
      phone: "923001112233",
      passwordHash: hash,
    },
  });

  // --- Subjects -----------------------------------------------------------
  const subjects = await Promise.all(
    ALL_SUBJECTS.map((s) =>
      prisma.subject.create({ data: { schoolId: sid, name: s.name, code: s.code } }),
    ),
  );
  const subjectByName = new Map(subjects.map((s) => [s.name, s]));

  // --- Teachers (each with a main subject) --------------------------------
  const teachers = await Promise.all(
    TEACHER_NAMES.map((name, i) =>
      prisma.user.create({
        data: {
          schoolId: sid,
          email: `teacher${i + 1}@tf.test`,
          name,
          role: "TEACHER",
          phone: `92300200${String(i + 1).padStart(4, "0")}`,
          mainSubjectId: subjects[i % subjects.length].id,
          passwordHash: hash,
        },
      }),
    ),
  );

  // --- Classes + sections + class teacher ---------------------------------
  type ClassRec = {
    id: string;
    name: string;
    prep: boolean;
    age: number;
    sections: { id: string; name: string }[];
    subjectNames: string[];
  };
  const classRecs: ClassRec[] = [];

  for (let ci = 0; ci < CLASSES.length; ci++) {
    const c = CLASSES[ci];
    const classTeacher = teachers[ci % teachers.length];
    const cls = await prisma.class.create({
      data: {
        schoolId: sid,
        name: c.name,
        level: c.level,
        classTeacherId: classTeacher.id,
        hasSections: true,
      },
    });
    // Prep classes: one section; others: A and B.
    const sectionNames = c.prep ? ["A"] : ["A", "B"];
    const sections = await Promise.all(
      sectionNames.map((name, si) =>
        prisma.section.create({
          data: {
            schoolId: sid,
            classId: cls.id,
            name,
            sectionTeacherId: teachers[(ci + si) % teachers.length].id,
          },
        }),
      ),
    );
    classRecs.push({
      id: cls.id,
      name: c.name,
      prep: c.prep,
      age: c.age,
      sections,
      subjectNames: c.prep ? PREP_SUBJECTS : ALL_SUBJECTS.map((s) => s.name),
    });
  }

  // --- Teacher assignments (subject x class -> a teacher) -----------------
  let assignCursor = 0;
  type Assignment = { teacherId: string; subjectId: string; classId: string };
  const assignments: Assignment[] = [];
  for (const cls of classRecs) {
    for (const subName of cls.subjectNames) {
      const subject = subjectByName.get(subName)!;
      const teacher = teachers[assignCursor % teachers.length];
      assignCursor++;
      assignments.push({ teacherId: teacher.id, subjectId: subject.id, classId: cls.id });
    }
  }
  await chunked(assignments, 20, (a) =>
    prisma.teacherAssignment.create({
      data: { schoolId: sid, teacherId: a.teacherId, subjectId: a.subjectId, classId: a.classId },
    }),
  );

  // --- Students (grouped into families -> siblings) -----------------------
  const nowYear = new Date().getUTCFullYear();
  type StudentRec = {
    id: string;
    classId: string;
    sectionId: string | null;
    gender: Gender;
  };
  const studentsByClass = new Map<string, StudentRec[]>();
  const allStudents: StudentRec[] = [];

  // A family shares a surname and a parent. We fill classes one student at a
  // time, occasionally spawning a multi-child family whose siblings land in
  // (usually different) classes.
  type Family = { surname: string; fatherName: string; childIds: string[] };
  const families: Family[] = [];

  // Pre-create empty student slots per class, then fill.
  const classQuota = classRecs.map((c) => ({ cls: c, remaining: randInt(15, 20), roll: 1 }));

  function openClasses() {
    return classQuota.filter((q) => q.remaining > 0);
  }

  async function createStudentIn(
    q: (typeof classQuota)[number],
    surname: string,
    fatherName: string,
  ): Promise<StudentRec> {
    const cls = q.cls;
    const gender: Gender = chance(0.5) ? "MALE" : "FEMALE";
    const first = gender === "MALE" ? pick(MALE_FIRST) : pick(FEMALE_FIRST);
    const section = pick(cls.sections);
    const birthYear = nowYear - cls.age;
    const student = await prisma.student.create({
      data: {
        schoolId: sid,
        classId: cls.id,
        sectionId: section.id,
        name: `${first} ${surname}`,
        rollNumber: String(q.roll++),
        fatherName,
        fatherCnic: String(randInt(10, 99)) + String(randInt(1000000000000, 9999999999999)).slice(0, 11),
        gender,
        dateOfBirth: new Date(Date.UTC(birthYear, randInt(0, 11), randInt(1, 28))),
        admissionDate: new Date(Date.UTC(nowYear - randInt(0, 3), randInt(0, 11), randInt(1, 28))),
      },
    });
    q.remaining--;
    const rec: StudentRec = {
      id: student.id,
      classId: cls.id,
      sectionId: section.id,
      gender,
    };
    const list = studentsByClass.get(cls.id) ?? [];
    list.push(rec);
    studentsByClass.set(cls.id, list);
    allStudents.push(rec);
    return rec;
  }

  // Fill until every class quota is exhausted, forming families as we go.
  while (openClasses().length > 0) {
    const surname = pick(SURNAMES);
    const fatherName = `${pick(MALE_FIRST)} ${surname}`;
    // Family size: mostly 1, often 2, sometimes 3 (gives us plenty of siblings).
    const size = chance(0.35) ? (chance(0.3) ? 3 : 2) : 1;
    const family: Family = { surname, fatherName, childIds: [] };
    for (let k = 0; k < size; k++) {
      const open = openClasses();
      if (open.length === 0) break;
      const q = pick(open);
      const child = await createStudentIn(q, surname, fatherName);
      family.childIds.push(child.id);
    }
    if (family.childIds.length > 0) families.push(family);
  }

  // --- Parents (one per family), linked to their children -----------------
  let parentCounter = 0;
  await chunked(families, 15, async (family) => {
    parentCounter++;
    const idx = parentCounter;
    const parent = await prisma.user.create({
      data: {
        schoolId: sid,
        email: `parent${idx}@tf.test`,
        name: family.fatherName,
        role: "PARENT",
        phone: `92301${String(3000000 + idx).slice(0, 7)}`,
        cnic: String(randInt(10, 99)) + String(randInt(1000000000000, 9999999999999)).slice(0, 11),
        passwordHash: hash,
      },
    });
    await prisma.parentStudent.createMany({
      data: family.childIds.map((studentId) => ({
        schoolId: sid,
        parentId: parent.id,
        studentId,
        relation: "FATHER" as const,
      })),
    });
  });

  const siblingFamilies = families.filter((f) => f.childIds.length > 1);

  // --- Attendance: last ~12 school days -----------------------------------
  const days = recentSchoolDays(12);
  const attendanceRows: {
    schoolId: string;
    studentId: string;
    classId: string;
    sectionId: string | null;
    date: Date;
    status: AttendanceStatus;
    markedById: string;
  }[] = [];
  for (const s of allStudents) {
    for (const date of days) {
      // ~90% present, rest split across absent/late/leave.
      const r = rng();
      const status: AttendanceStatus =
        r < 0.9 ? "PRESENT" : r < 0.95 ? "ABSENT" : r < 0.98 ? "LATE" : "LEAVE";
      attendanceRows.push({
        schoolId: sid,
        studentId: s.id,
        classId: s.classId,
        sectionId: s.sectionId,
        date,
        status,
        markedById: head.id,
      });
    }
  }
  // createMany in batches to keep the statement size sane.
  for (let i = 0; i < attendanceRows.length; i += 500) {
    await prisma.attendance.createMany({ data: attendanceRows.slice(i, i + 500) });
  }

  // --- Planner: last 4 school days for each assignment --------------------
  const plannerDays = recentSchoolDays(4);
  const topicsBySubject: Record<string, string[]> = {
    English: ["Reading comprehension", "Tenses revision", "Creative writing", "Vocabulary building"],
    Urdu: ["Nazm ki tashreeh", "Grammar - Ism o Fail", "Mazmoon nawesi", "Sabaq ka khulasa"],
    Mathematics: ["Multiplication drills", "Fractions", "Geometry basics", "Word problems"],
    Science: ["States of matter", "The human body", "Plants and photosynthesis", "Simple machines"],
    "Social Studies": ["Map of Pakistan", "Our community", "Famous leaders", "Natural resources"],
    Islamiat: ["Kalma and their meaning", "Seerat-un-Nabi", "Akhlaqiat", "Namaz ki ahmiyat"],
    "Computer Science": ["Parts of a computer", "Introduction to MS Paint", "Keyboard basics", "What is the internet"],
    Art: ["Primary colours", "Still-life drawing", "Clay modelling", "Collage work"],
  };
  const plannerRows: {
    schoolId: string;
    teacherId: string;
    classId: string;
    subjectId: string;
    date: Date;
    topic: string;
    details: string;
    homework: string | null;
    status: "PLANNED" | "COMPLETED";
  }[] = [];
  const subjectNameById = new Map(subjects.map((s) => [s.id, s.name]));
  for (const a of assignments) {
    const subName = subjectNameById.get(a.subjectId)!;
    const topics = topicsBySubject[subName] ?? ["Lesson of the day"];
    for (const date of plannerDays) {
      const topic = pick(topics);
      plannerRows.push({
        schoolId: sid,
        teacherId: a.teacherId,
        classId: a.classId,
        subjectId: a.subjectId,
        date,
        topic,
        details: `Cover "${topic}" with class activity and board work. Q&A to close the lesson.`,
        homework: chance(0.6) ? `Exercise on "${topic}" - complete in notebook.` : null,
        // Older days are marked taught; the most recent stays planned.
        status: date.getTime() < plannerDays[plannerDays.length - 1].getTime() ? "COMPLETED" : "PLANNED",
      });
    }
  }
  for (let i = 0; i < plannerRows.length; i += 500) {
    await prisma.plannerEntry.createMany({ data: plannerRows.slice(i, i + 500) });
  }

  // --- Fees ---------------------------------------------------------------
  const catTuition = await prisma.feeCategory.create({ data: { schoolId: sid, name: "Tuition" } });
  const catAdmission = await prisma.feeCategory.create({ data: { schoolId: sid, name: "Admission" } });
  const catExam = await prisma.feeCategory.create({ data: { schoolId: sid, name: "Exam Fee" } });
  const catTransport = await prisma.feeCategory.create({ data: { schoolId: sid, name: "Transport" } });

  // Monthly tuition rises with class level; a flat transport fee for opt-ins.
  const tuitionByClass = new Map<string, number>();
  for (let i = 0; i < classRecs.length; i++) {
    const cls = classRecs[i];
    const amount = 2000 + i * 400; // Prep 1 = 2000 ... Class 8 = 5600
    tuitionByClass.set(cls.id, amount);
    await prisma.feeStructure.create({
      data: {
        schoolId: sid,
        categoryId: catTuition.id,
        classId: cls.id,
        label: `${cls.name} monthly tuition`,
        amount: amount.toFixed(2),
        frequency: "MONTHLY",
      },
    });
  }
  const transportStructure = await prisma.feeStructure.create({
    data: {
      schoolId: sid,
      categoryId: catTransport.id,
      classId: null,
      label: "Van service (monthly)",
      amount: (1500).toFixed(2),
      frequency: "MONTHLY",
    },
  });
  await prisma.feeStructure.create({
    data: {
      schoolId: sid,
      categoryId: catAdmission.id,
      classId: null,
      label: "One-time admission fee",
      amount: (5000).toFixed(2),
      frequency: "ONE_TIME",
    },
  });
  await prisma.feeStructure.create({
    data: {
      schoolId: sid,
      categoryId: catExam.id,
      classId: null,
      label: "Mid-term examination fee",
      amount: (800).toFixed(2),
      frequency: "ONE_TIME",
    },
  });

  // Current-month invoices: one per student, tuition (+ transport for some).
  const today = dayUTC(0);
  const period = monthPeriod(today);
  const dueDate = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 10));
  const invoiceTitle = `Tuition Fee - ${monthLabel(today)}`;

  await chunked(allStudents, 25, async (s) => {
    const tuition = tuitionByClass.get(s.classId)!;
    const takesTransport = chance(0.4);
    let total = tuition;
    if (takesTransport) total += 1500;

    // Payment outcome: ~50% paid, ~20% partial, ~30% unpaid.
    const r = rng();
    const outcome = r < 0.5 ? "PAID" : r < 0.7 ? "PARTIAL" : "UNPAID";
    let paidAmount = 0;
    if (outcome === "PAID") paidAmount = total;
    else if (outcome === "PARTIAL") paidAmount = Math.round(total * 0.5);

    // Create the invoice first; line items and payments carry the composite
    // (schoolId, invoiceId) FK, so they're written via createMany with raw
    // scalars (nested create can't set the relation's schoolId directly).
    const invoice = await prisma.invoice.create({
      data: {
        schoolId: sid,
        studentId: s.id,
        classId: s.classId,
        period,
        title: invoiceTitle,
        dueDate,
        status: outcome === "PAID" ? "PAID" : outcome === "PARTIAL" ? "PARTIAL" : "UNPAID",
        total: total.toFixed(2),
        paidAmount: paidAmount.toFixed(2),
      },
    });

    const lineItems = [
      { schoolId: sid, invoiceId: invoice.id, description: "Monthly tuition", amount: tuition.toFixed(2) },
    ];
    if (takesTransport) {
      lineItems.push({
        schoolId: sid,
        invoiceId: invoice.id,
        description: "Van service",
        amount: (1500).toFixed(2),
        feeStructureId: transportStructure.id,
      } as (typeof lineItems)[number]);
    }
    await prisma.invoiceLineItem.createMany({ data: lineItems });

    if (paidAmount > 0) {
      await prisma.payment.create({
        data: {
          schoolId: sid,
          invoiceId: invoice.id,
          amount: paidAmount.toFixed(2),
          method: outcome === "PAID" && chance(0.4) ? "BANK_TRANSFER" : "CASH",
          status: "VERIFIED",
          recordedById: head.id,
          verifiedAt: today,
          note: outcome === "PAID" ? "Full payment received" : "Part payment",
        },
      });
    }
  });

  // --- Mid-Term Examination per class (published, with marks) -------------
  const examStart = dayUTC(7);
  for (const cls of classRecs) {
    const exam = await prisma.exam.create({
      data: {
        schoolId: sid,
        classId: cls.id,
        name: "Mid-Term Examination",
        type: "MIDTERM",
        term: `Term 1 (${nowYear}-${String((nowYear + 1) % 100).padStart(2, "0")})`,
        startDate: examStart,
        isPublished: true,
      },
    });

    const examSubjects = await Promise.all(
      cls.subjectNames.map((subName) =>
        prisma.examSubject.create({
          data: {
            schoolId: sid,
            examId: exam.id,
            subjectId: subjectByName.get(subName)!.id,
            maxMarks: (100).toFixed(2),
            passMarks: (40).toFixed(2),
          },
        }),
      ),
    );

    const roster = studentsByClass.get(cls.id) ?? [];
    const resultRows: {
      schoolId: string;
      examSubjectId: string;
      studentId: string;
      marksObtained: string | null;
      isAbsent: boolean;
      recordedById: string;
    }[] = [];
    for (const es of examSubjects) {
      for (const s of roster) {
        const absent = chance(0.03);
        resultRows.push({
          schoolId: sid,
          examSubjectId: es.id,
          studentId: s.id,
          marksObtained: absent ? null : randInt(28, 98).toFixed(2),
          isAbsent: absent,
          recordedById: head.id,
        });
      }
    }
    for (let i = 0; i < resultRows.length; i += 500) {
      await prisma.examResult.createMany({ data: resultRows.slice(i, i + 500) });
    }
  }

  // --- A couple of welcome notifications ----------------------------------
  await prisma.notification.createMany({
    data: [
      {
        schoolId: sid,
        recipientId: head.id,
        type: "GENERAL",
        title: "School data ready",
        body: "Telecom Foundation is set up: classes, students, attendance, fees and mid-term results are loaded.",
        readAt: new Date(),
      },
    ],
  });

  // --- Summary ------------------------------------------------------------
  const [studentCount, parentCount, invoiceCount, attCount, resultCount] = await Promise.all([
    prisma.student.count({ where: { schoolId: sid } }),
    prisma.user.count({ where: { schoolId: sid, role: "PARENT" } }),
    prisma.invoice.count({ where: { schoolId: sid } }),
    prisma.attendance.count({ where: { schoolId: sid } }),
    prisma.examResult.count({ where: { schoolId: sid } }),
  ]);

  await prisma.$disconnect();

  console.log(`
Telecom Foundation seeded. All passwords: ${PASSWORD}
School slug: ${SLUG}

  HEAD      head@tf.test
  TEACHERS  teacher1@tf.test ... teacher10@tf.test
  PARENTS   parent1@tf.test ... parent${parentCounter}@tf.test

Totals:
  Classes ............ ${classRecs.length} (Prep 1, Prep 2, Class 1-8)
  Teachers ........... ${teachers.length}
  Students ........... ${studentCount}
  Parents (families) . ${parentCount}  (${siblingFamilies.length} with siblings)
  Attendance rows .... ${attCount}  (${days.length} school days)
  Invoices ........... ${invoiceCount}  (month ${period})
  Exam results ....... ${resultCount}  (Mid-Term, published)

Sign in with the School field set to "${SLUG}".
`);
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
