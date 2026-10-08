import { getSessionUser } from "@/server/auth/dal";
import { getClassAttendanceReport } from "@/server/academics/attendance";
import { normalizeDate, presentRate } from "@/lib/attendance";
import { toCsv } from "@/lib/csv";

/**
 * CSV export of a class attendance report (Module 3.4). Role-gated to
 * HEAD/TEACHER; the report service enforces tenant + per-class access. Returns
 * a downloadable text/csv attachment.
 */
export async function GET(request: Request): Promise<Response> {
  const user = await getSessionUser();
  if (!user || (user.role !== "HEAD" && user.role !== "TEACHER")) {
    return new Response("Forbidden", { status: 403 });
  }

  const params = new URL(request.url).searchParams;
  const classId = params.get("classId") ?? "";
  const sectionId = params.get("sectionId") || null;
  const from = normalizeDate(params.get("from") ?? undefined);
  const to = normalizeDate(params.get("to") ?? undefined);
  if (!classId) return new Response("Missing classId", { status: 400 });

  let report: Awaited<ReturnType<typeof getClassAttendanceReport>>;
  try {
    report = await getClassAttendanceReport({
      classId,
      sectionId,
      from: new Date(from),
      to: new Date(to),
    });
  } catch (e) {
    return new Response(e instanceof Error ? e.message : "Unable to build report", { status: 400 });
  }

  const header = [
    "Roll",
    "Student",
    "Section",
    "Present",
    "Absent",
    "Late",
    "Leave",
    "Total",
    "% Present",
  ];
  const body = report.rows.map((r) => {
    const rate = presentRate(r.counts.PRESENT, r.counts.total);
    return [
      r.student.rollNumber ?? "",
      r.student.name,
      r.student.section?.name ?? "",
      r.counts.PRESENT,
      r.counts.ABSENT,
      r.counts.LATE,
      r.counts.LEAVE,
      r.counts.total,
      rate == null ? "" : `${rate}%`,
    ];
  });
  const totalsRate = presentRate(report.totals.PRESENT, report.totals.total);
  const totals = [
    "",
    "Total",
    "",
    report.totals.PRESENT,
    report.totals.ABSENT,
    report.totals.LATE,
    report.totals.LEAVE,
    report.totals.total,
    totalsRate == null ? "" : `${totalsRate}%`,
  ];

  const csv = toCsv([header, ...body, totals]);
  const filename = `attendance-${report.class.name}-${from}-to-${to}.csv`.replace(/[^\w.-]+/g, "_");

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
