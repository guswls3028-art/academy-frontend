import api from "@/shared/api/axios";
import { expectedUpdatedAtHeaders } from "@/shared/api/optimisticConcurrency";
import type { Exam } from "../types";
import { normalizeExam } from "./examNormalize";

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
    | "max_score"
    | "grading_mode"
    | "manual_grading_method"
    | "choice_question_count"
    | "essay_numbering"
    | "display_order"
    | "open_at"
    | "close_at"
    | "answer_visibility"
    | "student_results_published"
  >>,
  expectedUpdatedAt: string,
): Promise<Exam & { regrade?: ExamRecalculation }> {
  const res = await api.patch(`/exams/${examId}/`, payload, {
    headers: expectedUpdatedAtHeaders(expectedUpdatedAt),
  });
  return {
    ...normalizeExam(res.data),
    regrade: res.data?.regrade,
  };
}

/** Remove a regular exam from this session, preserving recorded history when required. */
export async function deleteSessionExam(examId: number, sessionId: number): Promise<void> {
  await api.delete(`/exams/${examId}/`, { params: { session_id: sessionId } });
}

/**
 * POST /exams/{id}/save-as-template/
 * regular 시험에 template가 없을 때, 현재 설정으로 템플릿을 생성해 연결합니다.
 */
export async function saveExamAsTemplate(examId: number, payload?: { title?: string }): Promise<Exam> {
  const res = await api.post(`/exams/${examId}/save-as-template/`, payload ?? {});
  return normalizeExam(res.data);
}

/**
 * POST /exams/{id}/structure/ensure/
 * regular 시험이 템플릿 구조를 live 참조 중이면 이 시험만의 복사본을 만든다.
 */
export async function ensureExamStructure(examId: number): Promise<Exam> {
  const res = await api.post(`/exams/${examId}/structure/ensure/`);
  return normalizeExam(res.data);
}

/**
 * POST /exams/{id}/recalculate/
 * Completed/ready submissions are recalculated; individual failures remain explicit.
 */
export type ExamRecalculation = {
  exam_id: number;
  total: number;
  graded: number;
  skipped: number;
  failed: Array<{ submission_id: number; status: string; detail: string }>;
  manual_total?: number;
  manual_graded?: number;
  needs_review?: Array<{ submission_id?: number; enrollment_id?: number; detail: string }>;
};

export async function recalculateExam(
  examId: number
): Promise<ExamRecalculation> {
  const res = await api.post<ExamRecalculation>(
    `/exams/${examId}/recalculate/`
  );
  return res.data;
}
