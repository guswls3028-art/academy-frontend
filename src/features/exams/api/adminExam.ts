import api from "@/shared/api/axios";
import { Exam } from "../types";

function normalizeExam(raw: any): Exam {
  return {
    id: Number(raw.id),

    title: String(raw.title ?? ""),
    description: String(raw.description ?? ""),
    subject: String(raw.subject ?? ""),

    exam_type: raw.exam_type,

    is_active: Boolean(raw.is_active),
    allow_retake: Boolean(raw.allow_retake),
    max_attempts: Number(raw.max_attempts ?? 0),

    pass_score: Number(raw.pass_score ?? 0),

    open_at: raw.open_at ?? null,
    close_at: raw.close_at ?? null,

    template_exam_id: raw.template_exam_id ?? null,

    created_at: raw.created_at,
    updated_at: raw.updated_at,
  };
}

/**
 * GET /exams/{id}/
 */
export async function fetchAdminExam(
  examId: number
): Promise<Exam> {
  const res = await api.get(`/exams/${examId}/`);
  return normalizeExam(res.data);
}

/**
 * PATCH /exams/{id}/
 * ✅ 서버 필드만 허용
 */
export async function updateAdminExam(
  examId: number,
  payload: Partial<Pick<
    Exam,
    | "title"
    | "description"
    | "subject"
    | "is_active"
    | "allow_retake"
    | "max_attempts"
    | "pass_score"
    | "open_at"
    | "close_at"
  >>
): Promise<Exam> {
  const res = await api.patch(`/exams/${examId}/`, payload);
  return normalizeExam(res.data);
}

/**
 * POST /exams/{id}/recalculate/
 * (없으면 no-op)
 */
export async function recalculateExam(
  examId: number
) {
  try {
    const res = await api.post(
      `/exams/${examId}/recalculate/`
    );
    return res.data;
  } catch {
    console.warn("recalculateExam not implemented");
    return null;
  }
}
