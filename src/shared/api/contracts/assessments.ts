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

export type AssessmentHomeworkCutlineMode = "PERCENT" | "COUNT";

export type AssessmentHomeworkPolicy = {
  id: number;
  session: number;
  cutline_mode: AssessmentHomeworkCutlineMode;
  cutline_value: number;
  round_unit_percent: number;
  created_at: string;
  updated_at: string;
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

function normalizeHomeworkPolicy(raw: unknown): AssessmentHomeworkPolicy {
  const record = asRecord(raw);
  const modeRaw = String(record.cutline_mode ?? "").toUpperCase();
  const mode: AssessmentHomeworkCutlineMode = modeRaw === "COUNT" ? "COUNT" : "PERCENT";
  const valueRaw = record.cutline_value ?? record.cutline_percent ?? 80;

  return {
    id: Number(record.id),
    session: Number(record.session ?? record.session_id ?? 0),
    cutline_mode: mode,
    cutline_value: Number(valueRaw),
    round_unit_percent: Number(record.round_unit_percent ?? 5),
    created_at: String(record.created_at ?? ""),
    updated_at: String(record.updated_at ?? ""),
  };
}

export async function fetchAssessmentHomeworkPolicyBySession(
  sessionId: number,
): Promise<AssessmentHomeworkPolicy | null> {
  if (!Number.isFinite(sessionId) || sessionId <= 0) return null;

  const res = await api.get("/homework/policies/", {
    params: { session: sessionId },
  });
  const list = unwrapList(res.data);
  return list.length > 0 ? normalizeHomeworkPolicy(list[0]) : null;
}
