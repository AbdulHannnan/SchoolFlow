/**
 * Demo seed for local manual testing. Creates a SUPER_ADMIN plus one school
 * ("demo") with a HEAD, a TEACHER (assigned to Grade 1), a PARENT (linked to a
 * student), classes/sections/students, and a week of sample attendance so the
 * views and reports show data out of the box.
 *
 * Idempotent: it wipes the demo school and the super admin first, then rebuilds.
 * Runs on the OWNER connection (bypasses RLS), like the onboarding flow.
 *
 *   npm run db:seed
 *
 * All accounts use the password: password
 */
import { prisma } from "../src/server/db/index.ts";
import { hashPassword } from "../src/server/auth/password.ts";

const PASSWORD = "password";

/** UTC midnight for `daysAgo` days before today. */
function dayUTC(daysAgo: number): Date {
  const now = new Date();
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d;
}

async function main() {
  // --- Clean previous demo data ------------------------------------------
  await prisma.school.deleteMany({ where: { slug: "demo" } });
  await prisma.user.deleteMany({ where: { email: "admin@demo.test", schoolId: null } });

  const hash = await hashPassword(PASSWORD);

  // --- Platform operator (signs in with NO school slug) ------------------
  await prisma.user.create({
    data: {
      email: "admin@demo.test",
      name: "Platform Admin",
      role: "SUPER_ADMIN",
      passwordHash: hash,
    },
  });

  // --- School + its people -----------------------------------------------
  const school = await prisma.school.create({ data: { name: "Demo School", slug: "demo" } });
  const sid = school.id;

  const [head, teacher, parent] = await Promise.all([
    prisma.user.create({
      data: {
        schoolId: sid,
        email: "head@demo.test",
        name: "Head Teacher",
        role: "HEAD",
        phone: "923000000001",
        passwordHash: hash,
      },
    }),
    prisma.user.create({
      data: {
        schoolId: sid,
        email: "teacher@demo.test",
        name: "Ms. Khan",
        role: "TEACHER",
        phone: "923000000002",
        passwordHash: hash,
      },
    }),
    prisma.user.create({
      data: {
        schoolId: sid,
        email: "parent@demo.test",
        name: "Mr. Ali",
        role: "PARENT",
        phone: "923000000003",
        passwordHash: hash,
      },
    }),
  ]);

  // --- Classes, sections, subject ----------------------------------------
  const grade1 = await prisma.class.create({ data: { schoolId: sid, name: "Grade 1", level: 1 } });
  const grade2 = await prisma.class.create({ data: { schoolId: sid, name: "Grade 2", level: 2 } });
  const [secA, secB] = await Promise.all([
    prisma.section.create({ data: { schoolId: sid, classId: grade1.id, name: "A" } }),
    prisma.section.create({ data: { schoolId: sid, classId: grade1.id, name: "B" } }),
  ]);
  const math = await prisma.subject.create({
    data: { schoolId: sid, name: "Mathematics", code: "MATH" },
  });

  // Teacher teaches Maths in Grade 1 -> can mark/report Grade 1 only.
  await prisma.teacherAssignment.create({
    data: { schoolId: sid, teacherId: teacher.id, subjectId: math.id, classId: grade1.id },
  });

  // --- Students -----------------------------------------------------------
  const g1 = await Promise.all(
    [
      { name: "Ayesha Ahmed", rollNumber: "1", sectionId: secA.id },
      { name: "Bilal Raza", rollNumber: "2", sectionId: secA.id },
      { name: "Fatima Noor", rollNumber: "3", sectionId: secA.id },
      { name: "Hassan Tariq", rollNumber: "4", sectionId: secB.id },
      { name: "Zainab Malik", rollNumber: "5", sectionId: secB.id },
    ].map((s) =>
      prisma.student.create({
        data: {
          schoolId: sid,
          classId: grade1.id,
          sectionId: s.sectionId,
          name: s.name,
          rollNumber: s.rollNumber,
        },
      }),
    ),
  );
  await Promise.all(
    [
      { name: "Omar Sheikh", rollNumber: "1" },
      { name: "Sara Javed", rollNumber: "2" },
    ].map((s) =>
      prisma.student.create({
        data: { schoolId: sid, classId: grade2.id, name: s.name, rollNumber: s.rollNumber },
      }),
    ),
  );

  // Link the parent to Ayesha (first Grade 1 student).
  await prisma.parentStudent.create({
    data: { schoolId: sid, parentId: parent.id, studentId: g1[0].id, relation: "FATHER" },
  });

  // --- Sample attendance: last 5 days for Grade 1 ------------------------
  // Mostly present, with a couple of absences/lates so reports look real.
  const plan: Record<string, Array<"PRESENT" | "ABSENT" | "LATE" | "LEAVE">> = {
    [g1[0].id]: ["PRESENT", "PRESENT", "PRESENT", "PRESENT", "PRESENT"], // Ayesha
    [g1[1].id]: ["PRESENT", "ABSENT", "PRESENT", "PRESENT", "ABSENT"], // Bilal
    [g1[2].id]: ["LATE", "PRESENT", "PRESENT", "LEAVE", "PRESENT"], // Fatima
    [g1[3].id]: ["PRESENT", "PRESENT", "LATE", "PRESENT", "PRESENT"], // Hassan
    [g1[4].id]: ["PRESENT", "PRESENT", "PRESENT", "ABSENT", "PRESENT"], // Zainab
  };
  for (const student of g1) {
    const statuses = plan[student.id];
    for (let i = 0; i < statuses.length; i++) {
      await prisma.attendance.create({
        data: {
          schoolId: sid,
          studentId: student.id,
          classId: grade1.id,
          sectionId: student.sectionId,
          date: dayUTC(i + 1), // yesterday back to 5 days ago
          status: statuses[i],
          markedById: teacher.id,
        },
      });
    }
  }

  // --- A few in-app notifications so the inbox isn't empty ---------------
  // Written directly on the OWNER connection, like the rest of the seed. In
  // the app, notifications are produced by the engine (dispatch/notifyUsers).
  await prisma.notification.createMany({
    data: [
      {
        schoolId: sid,
        recipientId: head.id,
        type: "GENERAL",
        title: "Welcome to your dashboard",
        body: "Your school is set up: classes, students and attendance are ready to go.",
        readAt: new Date(),
      },
      {
        schoolId: sid,
        recipientId: teacher.id,
        type: "GENERAL",
        title: "You are assigned to Grade 1",
        body: "You can mark attendance for Grade 1 from the Attendance page.",
      },
      {
        schoolId: sid,
        recipientId: parent.id,
        type: "ATTENDANCE_ABSENT",
        title: "Ayesha was marked absent",
        body: "Ayesha Ahmed was marked absent earlier this week. Tap to review attendance.",
        data: { studentId: g1[0].id },
      },
    ],
  });

  await prisma.$disconnect();

  console.log(`
Demo data ready. All passwords: ${PASSWORD}

  SUPER_ADMIN  admin@demo.test     (School field: leave blank)
  HEAD         head@demo.test      (School: demo)
  TEACHER      teacher@demo.test   (School: demo)  - assigned to Grade 1
  PARENT       parent@demo.test    (School: demo)  - linked to Ayesha Ahmed

School slug: demo
Grade 1 has sections A/B and 5 students with ~a week of attendance already marked.
`);
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
