import api from "@/shared/api/axios";
import type { components, paths } from "@/shared/api/generated/schema";

type SchoolReportSchemas = components["schemas"];
type SchoolReportRequest = SchoolReportSchemas["SchoolReportRequestRequest"];
type SchoolReportRosterQuery = paths["/api/v1/results/school-reports/"]["get"]["parameters"]["query"];
type SchoolReportDetail = SchoolReportSchemas["SchoolReportDetailResponse"];
type SchoolReportRoster = SchoolReportSchemas["SchoolReportRosterResponse"];
type SchoolReportRequestResult = SchoolReportSchemas["SchoolReportRequestResponse"];

export type SchoolReportPeriod = Pick<SchoolReportRequest, "academic_year" | "exam_round"> & { semester: 1 | 2 };
export type SchoolReportStatus = SchoolReportSchemas["SchoolReportSubmissionStatus"];
export type SchoolReportSubject = Pick<SchoolReportSchemas["SchoolReportSubjectRequest"], "subject" | "score" | "max_score">;
export type SchoolReportScore = SchoolReportSchemas["SchoolReportScoreResponse"];
export type SchoolReportRosterFilters = Pick<SchoolReportRosterQuery, "status" | "lecture_id"> & { search: string; page: number };

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
  const { data } = await api.put<SchoolReportDetail>(endpoint + "me/",
    { subjects } satisfies SchoolReportSchemas["SchoolReportEntryRequest"], { params: period });
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
  const { data } = await api.post<SchoolReportRequestResult>(
    endpoint + "requests/", { ...period, student_ids: studentIds } satisfies SchoolReportRequest,
  );
  return data;
}
