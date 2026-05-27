import api from "@/shared/api/axios";
import { isApiRecord } from "@/shared/api/response";

export type AssessmentExamListItem = {
  id: number;
  title: string;
  max_score?: number | null;
  pass_score?: number | null;
};

export type AssessmentHomeworkListItem = {
  id: number;
  title: string;
  session_id?: number;
};

function unwrapList(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;
  if (isApiRecord(data) && Array.isArray(data.results)) return data.results;
  if (isApiRecord(data) && Array.isArray(data.items)) return data.items;
  return [];
}

function asRecord(value: unknown): Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function asPositiveNumber(value: unknown): number | null {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) && numericValue > 0 ? numericValue : null;
}

export async function fetchAssessmentExams(params?: {
  exam_type?: "template" | "regular";
  session_id?: number;
  lecture_id?: number;
}): Promise<AssessmentExamListItem[]> {
  const res = await api.get("/exams/", { params });
  return unwrapList(res.data).map((item) => {
    const record = asRecord(item);
    return {
      id: Number(record.id),
      title: String(record.title ?? ""),
      max_score: record.max_score == null ? null : Number(record.max_score),
      pass_score: record.pass_score == null ? null : Number(record.pass_score),
    };
  });
}

export async function fetchAssessmentHomeworks(params?: {
  session_id?: number;
}): Promise<AssessmentHomeworkListItem[]> {
  const res = await api.get("/homeworks/", { params });
  return unwrapList(res.data).map((item) => {
    const record = asRecord(item);
    const sid = record.session_id ?? record.session ?? record.sessionId;
    return {
      id: Number(record.id),
      title: String(record.title ?? ""),
      session_id: asPositiveNumber(sid) ?? undefined,
    };
  });
}
