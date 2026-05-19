import api from "@/shared/api/axios";
import type { Exam, ExamType } from "../types";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function normalizeExam(rawValue: unknown): Exam {
  const raw = asRecord(rawValue);
  return {
    /**
     * ✅ 핵심 FIX
     * - id 우선
     * - 없으면 exam_id fallback
     */
    id: Number(raw.id ?? raw.exam_id),

    title: String(raw.title ?? ""),
    description: String(raw.description ?? ""),
    subject: String(raw.subject ?? ""),

    exam_type: raw.exam_type as ExamType,

    is_active: Boolean(raw.is_active),
    allow_retake: Boolean(raw.allow_retake),
    max_attempts: Number(raw.max_attempts ?? 0),

    pass_score: Number(raw.pass_score ?? 0),
    max_score: Number(raw.max_score ?? 100),
    display_order: Number(raw.display_order ?? 0),

    open_at: raw.open_at == null ? null : String(raw.open_at),
    close_at: raw.close_at == null ? null : String(raw.close_at),

    template_exam_id: raw.template_exam_id == null ? null : Number(raw.template_exam_id),

    answer_visibility: (raw.answer_visibility ?? "hidden") as Exam["answer_visibility"],

    status: (raw.status ?? "OPEN") as Exam["status"],

    created_at: String(raw.created_at ?? ""),
    updated_at: String(raw.updated_at ?? ""),
  };
}

/**
 * GET /exams/
 */
export async function fetchExams(params?: {
  exam_type?: ExamType;
  session_id?: number;
  lecture_id?: number;
}): Promise<Exam[]> {
  const res = await api.get(`/exams/`, { params });

  const data = res.data;

  const payload = asRecord(data);
  const items = Array.isArray(data)
    ? data
    : Array.isArray(payload.results)
    ? payload.results
    : Array.isArray(payload.items)
    ? payload.items
    : [];

  return items.map(normalizeExam);
}

/**
 * GET /exams/{id}/
 */
export async function fetchExam(
  examId: number
): Promise<Exam> {
  const res = await api.get(`/exams/${examId}/`);
  return normalizeExam(res.data);
}

/**
 * POST /exams/
 */
export async function createTemplateExam(
  payload: {
    title: string;
    subject: string;
    description?: string;
  }
): Promise<Exam> {
  const res = await api.post(`/exams/`, {
    title: payload.title,
    subject: payload.subject,
    description: payload.description ?? "",
    exam_type: "template",
  });

  return normalizeExam(res.data);
}

/**
 * POST /exams/
 */
export async function createRegularExam(
  payload: {
    title: string;
    template_exam_id: number;
    description?: string;
  }
): Promise<Exam> {
  const res = await api.post(`/exams/`, {
    title: payload.title,
    template_exam_id: payload.template_exam_id,
    description: payload.description ?? "",
    exam_type: "regular",
  });

  return normalizeExam(res.data);
}
