import axios from "axios";
import api from "@/shared/api/axios";
import { createRandomUuid } from "@/shared/utils/randomUuid";
import type { StudentReportedScoreSubmission, StudentSchoolExamRound, StudentScoreSource } from "@/shared/api/contracts/storage";

export type SurveyKind = "general" | "school_score" | "memo";
export type SurveyQuestionType = "text" | "textarea" | "number" | "date" | "single_choice" | "multiple_choice";
export type SurveyQuestion = { id: string; label: string; type: SurveyQuestionType; required: boolean; options: string[] };
export type SurveyScoreDefaults = { source?: StudentScoreSource; academic_year?: number; semester?: 1 | 2; exam_round?: StudentSchoolExamRound; exam_month?: number; exam_name?: string; subject?: string };
export type SurveyAudience = { mode: "all" | "selected" | "lecture"; student_ids: number[]; lecture_id?: number | null };
export type SurveyDraft = {
  title: string; description: string; kind: SurveyKind; questions: SurveyQuestion[];
  audience: SurveyAudience; score_defaults: SurveyScoreDefaults; allow_attachments: boolean;
  opens_at: string | null; closes_at: string | null; response_limit: number | null;
};
export type Survey = SurveyDraft & {
  id: number; status: "draft" | "open" | "closed"; version: number; published_at: string | null;
  created_at: string; updated_at: string; target_count?: number; response_count: number;
  answered: boolean; can_respond: boolean; response_unavailable_reason: string;
  selected_students?: { id: number; name: string }[];
};
export type SurveyAttachment = { id: number; name: string; size_bytes: number; content_type: string; r2_key: string };
export type SurveyAnswers = Record<string, string | number | string[]>;
export type SurveyResponse = {
  id: number; survey_id: number; survey_title: string; kind: SurveyKind; questions: SurveyQuestion[];
  student_id: number; student_name: string; student_ps: string; answers: SurveyAnswers; version: number;
  attachments: SurveyAttachment[]; score_submissions: StudentReportedScoreSubmission[]; created_at: string; updated_at: string;
};
export type SurveyResponseInput = { answers: SurveyAnswers; attachment_ids: number[]; score_submission_ids: number[]; expected_version: number };
export type SurveyPage<T> = { count: number; results: T[] };
export type SurveyRecipientRow = { student_id: number; student_name: string; answered: boolean; response: SurveyResponse | null };
export type SurveyStatistics = { response_count: number; target_count: number; questions: { id: string; label: string; options: { label: string; count: number }[] }[] };
export const SURVEY_KIND_LABEL: Record<SurveyKind, string> = { general: "일반 설문", school_score: "성적 취합", memo: "학생 메모" };
export const SURVEY_STATUS_LABEL = { draft: "작성 중", open: "응답 받는 중", closed: "마감" } as const;

const childHeaders = (studentId: number) => ({ "X-Student-Id": String(studentId) });

export const createSurveyRequestKey = createRandomUuid;

export function surveyDate(value: string | null) {
  return value ? new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "마감 없음";
}

export const surveysApi = {
  list: async (params: Record<string, string | number>) => (await api.get<SurveyPage<Survey>>("/surveys/", { params })).data,
  get: async (id: number) => (await api.get<Survey>(`/surveys/${id}/`)).data,
  create: async (draft: SurveyDraft, creationKey: string) => (await api.post<Survey>("/surveys/", { ...draft, creation_key: creationKey })).data,
  update: async (id: number, draft: Partial<SurveyDraft>, version: number) => (await api.patch<Survey>(`/surveys/${id}/`, { ...draft, expected_version: version })).data,
  publish: async (id: number, version: number) => (await api.post<Survey>(`/surveys/${id}/publish/`, { expected_version: version })).data,
  close: async (id: number, version: number) => (await api.post<Survey>(`/surveys/${id}/close/`, { expected_version: version })).data,
  students: async (search: string) => (await api.get<{ results: { id: number; name: string; school: string }[] }>("/surveys/student-choices/", { params: { search } })).data.results,
  responses: async (id: number, params: Record<string, string | number>) => (await api.get<SurveyPage<SurveyRecipientRow> & { survey: Survey }>(`/surveys/${id}/responses/`, { params })).data,
  statistics: async (id: number) => (await api.get<SurveyStatistics>(`/surveys/${id}/statistics/`)).data,
  studentHistory: async (id: number, offset = 0) => (await api.get<SurveyPage<SurveyResponse>>(`/surveys/students/${id}/responses/`, { params: { offset, limit: 10 } })).data,
  myList: async (studentId: number, offset = 0) => (await api.get<SurveyPage<Survey>>("/surveys/student/", { headers: childHeaders(studentId), params: { offset } })).data,
  myDetail: async (id: number, studentId: number) => (await api.get<{ survey: Survey; response: SurveyResponse | null }>(`/surveys/student/${id}/`, { headers: childHeaders(studentId) })).data,
  respond: async (id: number, studentId: number, input: SurveyResponseInput) => (await api.put<SurveyResponse>(`/surveys/student/${id}/response/`, input, { headers: childHeaders(studentId) })).data,
};

export function surveyError(error: unknown): string {
  const data: unknown = axios.isAxiosError(error) ? error.response?.data : null;
  const textValues = (value: unknown): string[] => {
    if (typeof value === "string") return [value];
    if (Array.isArray(value)) return value.flatMap(textValues);
    if (value && typeof value === "object") return Object.values(value).flatMap(textValues);
    return [];
  };
  const messages = textValues(data);
  if (messages.length) return messages.slice(0, 4).join(" ");
  if (error instanceof Error && !axios.isAxiosError(error)) return error.message;
  return "연결을 확인하고 다시 시도해 주세요. 입력한 내용은 그대로 유지됩니다.";
}

export async function downloadSurveyCsv(id: number, responseStatus: string) {
  const result = await api.get<Blob>(`/surveys/${id}/export/`, { params: { response_status: responseStatus }, responseType: "blob" });
  const url = URL.createObjectURL(result.data);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `설문-${id}-응답.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
