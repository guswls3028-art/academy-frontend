import api from "@/shared/api/axios";

export type SchoolReportPeriod = {
  academic_year: number;
  semester: 1 | 2;
  exam_round: "first" | "second";
};
export type SchoolReportStatus = "submitted" | "missing";
export type SchoolReportSubject = { subject: string; score: number; max_score: number };
export type SchoolReportScore = {
  id: number;
  subject: string;
  score: number | string;
  max_score: number | string;
  grade_rank: number | null;
};
export type SchoolReportDetail = SchoolReportPeriod & {
  student_name: string;
  status: SchoolReportStatus;
  submitted_at: string | null;
  requested_at: string | null;
  scores: SchoolReportScore[];
  direct_scores: SchoolReportScore[];
};
export type SchoolReportStudent = {
  student_id: number;
  name: string;
  school: string | null;
  grade: number | string | null;
  status: SchoolReportStatus;
  score_count: number;
  submitted_at: string | null;
  requested_at: string | null;
  can_request: boolean;
};
export type SchoolReportRosterFilters = {
  search: string;
  status?: SchoolReportStatus;
  lecture_id?: number;
  page: number;
};
type SchoolReportRoster = {
  count: number;
  next: string | null;
  previous: string | null;
  results: SchoolReportStudent[];
  total_count: number;
  submitted_count: number;
  missing_count: number;
};
type SchoolReportRequestResult = { requested: number; skipped: number };

const endpoint = "/results/school-reports/";
export const schoolReportKeys = {
  all: ["school-reports"] as const,
  own: (period: SchoolReportPeriod) => ["school-reports", "me", period] as const,
  detail: (studentId: number, period: SchoolReportPeriod) => ["school-reports", studentId, period] as const,
  roster: (period: SchoolReportPeriod, filters: SchoolReportRosterFilters) =>
    ["school-reports", "roster", period, filters] as const,
};

export async function fetchOwnSchoolReport(period: SchoolReportPeriod, signal?: AbortSignal) {
  const { data } = await api.get<SchoolReportDetail>(endpoint + "me/", { params: period, signal });
  return data;
}

export async function saveOwnSchoolReport(period: SchoolReportPeriod, subjects: SchoolReportSubject[]) {
  const { data } = await api.put<SchoolReportDetail>(endpoint + "me/", { subjects }, { params: period });
  return data;
}

export async function fetchSchoolReport(studentId: number, period: SchoolReportPeriod, signal?: AbortSignal) {
  const { data } = await api.get<SchoolReportDetail>(endpoint + studentId + "/", { params: period, signal });
  return data;
}

export async function fetchSchoolReportRoster(period: SchoolReportPeriod, filters: SchoolReportRosterFilters, signal?: AbortSignal) {
  const { data } = await api.get<SchoolReportRoster>(endpoint, { params: { ...period, ...filters }, signal });
  return data;
}

export async function requestSchoolReports(period: SchoolReportPeriod, studentIds: number[]) {
  const { data } = await api.post<SchoolReportRequestResult>(endpoint + "requests/", { ...period, student_ids: studentIds });
  return data;
}
