// PATH: src/app_admin/domains/homework/api/adminHomework.ts
import api from "@/shared/api/axios";
import {
  normalizeAssessmentPhaseStatus,
  type AssessmentPhaseStatus,
} from "@/shared/api/contracts/assessmentStatus";

export type AdminHomeworkDetail = {
  id: number;
  session_id?: number;
  homework_type?: "template" | "regular";
  template_homework_id?: number | null;

  title: string;
  description?: string;

  status: AssessmentPhaseStatus;

  /** Homework.meta JSON. default_max_score 등 추가 설정 보관. */
  meta?: Record<string, unknown> | null;
  /** meta.default_max_score 편의 접근자 */
  default_max_score?: number | null;

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

function normalize(raw: unknown): AdminHomeworkDetail {
  const record = asRecord(raw);
  const rawSession = record.session_id ?? record.session ?? record.sessionId;
  const meta = record.meta != null ? asRecord(record.meta) : null;
  const defaultMaxScore = meta ? asPositiveNumber(meta.default_max_score) : null;
  const templateHomeworkId = record.template_homework != null
    ? asPositiveNumber(record.template_homework)
    : asPositiveNumber(record.template_homework_id);

  return {
    id: Number(record.id),
    session_id: asPositiveNumber(rawSession) ?? undefined,
    homework_type: normalizeHomeworkType(record.homework_type),
    template_homework_id: templateHomeworkId,

    title: String(record.title ?? ""),
    description: typeof record.description === "string" ? record.description : undefined,

    status: normalizeAssessmentPhaseStatus(record.status),

    meta,
    default_max_score: defaultMaxScore,

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
  payload: Partial<AdminHomeworkDetail>
) {
  const res = await api.patch(`/homeworks/${homeworkId}/`, payload);
  return normalize(res.data);
}

/** POST /homeworks/<id>/save-as-template/ — 시험과 동일 */
export async function saveHomeworkAsTemplate(homeworkId: number) {
  const res = await api.post(`/homeworks/${homeworkId}/save-as-template/`);
  return res.data;
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
