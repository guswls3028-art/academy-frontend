// PATH: src/app_admin/domains/homework/api/adminHomework.ts
import api from "@/shared/api/axios";
import { expectedUpdatedAtHeaders } from "@/shared/api/optimisticConcurrency";
import type { HomeworkCutlineMode } from "../types";

export type AdminHomeworkDetail = {
  id: number;
  session_id?: number;
  homework_type?: "template" | "regular";
  template_homework_id?: number | null;
  source_exam_id: number | null;
  source_status: "none" | "processing" | "review_required" | "ready" | "failed" | "conversion_required";
  source_filename: string;
  source_question_count: number;

  title: string;
  description?: string;

  /** Homework.meta JSON. default_max_score 등 추가 설정 보관. */
  meta?: Record<string, unknown> | null;
  /** 과제별 만점. 서버가 meta.default_max_score의 유효 기본값까지 정규화한다. */
  max_score?: number | null;
  /** 레거시 호출부 호환용 편의 접근자 */
  default_max_score?: number | null;
  cutline_mode: HomeworkCutlineMode | null;
  cutline_value: number | null;
  round_unit_percent: number | null;
  effective_cutline_mode: HomeworkCutlineMode;
  effective_cutline_value: number;
  effective_round_unit_percent: number;
  uses_session_cutline_default: boolean;

  created_at: string;
  updated_at: string;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function asPositiveNumber(value: unknown): number | null {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) && numericValue > 0 ? numericValue : null;
}

function normalizeHomeworkType(value: unknown): NonNullable<AdminHomeworkDetail["homework_type"]> {
  return value === "template" || value === "regular" ? value : "regular";
}

function normalizeCutlineMode(value: unknown): HomeworkCutlineMode {
  return String(value).toUpperCase() === "COUNT" ? "COUNT" : "PERCENT";
}

function normalize(raw: unknown): AdminHomeworkDetail {
  const record = asRecord(raw);
  const rawSession = record.session_id ?? record.session ?? record.sessionId;
  const meta = record.meta != null ? asRecord(record.meta) : null;
  const defaultMaxScore = asPositiveNumber(record.max_score)
    ?? (meta ? asPositiveNumber(meta.default_max_score) : null)
    ?? 100;
  const templateHomeworkId = record.template_homework != null
    ? asPositiveNumber(record.template_homework)
    : asPositiveNumber(record.template_homework_id);
  const rawCutlineMode = record.cutline_mode == null
    ? null
    : normalizeCutlineMode(record.cutline_mode);
  const rawCutlineValue = record.cutline_value == null
    ? null
    : Number(record.cutline_value);
  const rawRoundUnit = record.round_unit_percent == null
    ? null
    : Number(record.round_unit_percent);

  return {
    id: Number(record.id),
    session_id: asPositiveNumber(rawSession) ?? undefined,
    homework_type: normalizeHomeworkType(record.homework_type),
    template_homework_id: templateHomeworkId,
    source_exam_id: asPositiveNumber(record.source_exam_id),
    source_status: String(record.source_status ?? "none") as AdminHomeworkDetail["source_status"],
    source_filename: String(record.source_filename ?? ""),
    source_question_count: Number(record.source_question_count ?? 0),

    title: String(record.title ?? ""),
    description: typeof record.description === "string" ? record.description : undefined,

    meta,
    max_score: defaultMaxScore,
    default_max_score: defaultMaxScore,
    cutline_mode: rawCutlineMode,
    cutline_value: Number.isFinite(rawCutlineValue) ? rawCutlineValue : null,
    round_unit_percent: Number.isFinite(rawRoundUnit) ? rawRoundUnit : null,
    effective_cutline_mode: normalizeCutlineMode(
      record.effective_cutline_mode ?? rawCutlineMode,
    ),
    effective_cutline_value: Number(
      record.effective_cutline_value ?? rawCutlineValue ?? 80,
    ),
    effective_round_unit_percent: Number(
      record.effective_round_unit_percent ?? rawRoundUnit ?? 5,
    ),
    uses_session_cutline_default: Boolean(
      record.uses_session_cutline_default ?? rawCutlineMode == null,
    ),

    created_at: String(record.created_at ?? ""),
    updated_at: String(record.updated_at ?? ""),
  };
}

export async function fetchAdminHomework(homeworkId: number) {
  const res = await api.get(`/homeworks/${homeworkId}/`);
  return normalize(res.data);
}

export async function updateAdminHomework(
  homeworkId: number,
  payload: Partial<AdminHomeworkDetail>,
  expectedUpdatedAt: string,
) {
  const res = await api.patch(`/homeworks/${homeworkId}/`, payload, {
    headers: expectedUpdatedAtHeaders(expectedUpdatedAt),
  });
  return normalize(res.data);
}

/** POST /homeworks/<id>/save-as-template/ — 시험과 동일 */
export async function saveHomeworkAsTemplate(homeworkId: number) {
  const res = await api.post(`/homeworks/${homeworkId}/save-as-template/`);
  return res.data;
}

export async function ensureHomeworkSourceExam(homeworkId: number) {
  const res = await api.post(`/homeworks/${homeworkId}/source-exam/`);
  return normalize(res.data);
}

export type HomeworkQuestionMark = {
  is_correct: boolean | null;
  include_in_wrong_note: boolean;
};

export type HomeworkQuestionGrading = {
  homework_id: number;
  source_exam_id: number;
  source_status: string;
  questions: Array<{ id: number; number: number; image_key: string }>;
  rows: Array<{
    enrollment_id: number;
    student_id: number;
    student_name: string;
    score_id: number | null;
    marks: Record<string, HomeworkQuestionMark>;
  }>;
};

export async function fetchHomeworkQuestionGrading(homeworkId: number) {
  const res = await api.get(`/homeworks/${homeworkId}/question-grading/`);
  return res.data as HomeworkQuestionGrading;
}

export async function updateHomeworkQuestionGrading(
  homeworkId: number,
  updates: Array<{
    enrollment_id: number;
    question_number: number;
    is_correct: boolean | null;
    include_in_wrong_note: boolean;
  }>,
) {
  const res = await api.patch(`/homeworks/${homeworkId}/question-grading/`, { updates });
  return res.data as HomeworkQuestionGrading;
}

export type HomeworkTemplateWithUsage = {
  id: number;
  title: string;
  last_used_date: string | null;
  used_lectures: Array<{
    lecture_id: number;
    lecture_title: string;
    chip_label: string;
    color: string;
    last_used_date: string | null;
  }>;
};

export async function fetchHomeworkTemplatesWithUsage(): Promise<HomeworkTemplateWithUsage[]> {
  const res = await api.get("/homeworks/templates/with-usage/");
  return Array.isArray(res.data) ? res.data : [];
}
