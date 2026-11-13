import type { SchoolReportPeriod } from "@/shared/api/contracts/schoolReports";

export const SCHOOL_REPORT_PERIODS = [
  { semester: 1, exam_round: "first" },
  { semester: 1, exam_round: "second" },
  { semester: 2, exam_round: "first" },
  { semester: 2, exam_round: "second" },
] as const;

export function currentSchoolReportPeriod(now = new Date()): SchoolReportPeriod {
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "numeric" });
  const parts = date.formatToParts(now);
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  if (month < 3) return { academic_year: year - 1, semester: 2, exam_round: "second" };
  return {
    academic_year: year,
    semester: month < 8 ? 1 : 2,
    exam_round: month === 6 || month === 7 || month >= 11 ? "second" : "first",
  };
}

export function schoolReportPeriodLabel(period: Pick<SchoolReportPeriod, "semester" | "exam_round">) {
  return `${period.semester}학기 ${period.exam_round === "first" ? "중간" : "기말"}`;
}

export function parseSchoolReportPeriod(values: Record<string, unknown>): SchoolReportPeriod | null {
  const academic_year = Number(values.academic_year);
  const semester = Number(values.semester);
  const exam_round = values.exam_round;
  if (!Number.isInteger(academic_year) || academic_year < 2000 || academic_year > 2100) return null;
  if ((semester !== 1 && semester !== 2) || (exam_round !== "first" && exam_round !== "second")) return null;
  return { academic_year, semester, exam_round };
}

export function schoolReportParams(period: SchoolReportPeriod) {
  return {
    academic_year: String(period.academic_year),
    semester: String(period.semester),
    exam_round: period.exam_round,
  };
}

export const studentSchoolReportPath = "/student/submit/school-report";

export function studentSchoolReportLink(period: SchoolReportPeriod) {
  return `${studentSchoolReportPath}?${new URLSearchParams(schoolReportParams(period))}`;
}
