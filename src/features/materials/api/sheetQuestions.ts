// ======================================================================================
// FILE: src/features/materials/api/sheetQuestions.ts  (SSOT ALIGN: /exams/<exam_id>/questions/)
// ======================================================================================
import api from "@/shared/api/axios";

export type SheetQuestionEntity = {
  id: number;
  sheet: number; // backend ExamQuestion.sheet (Sheet.id) — 프론트에서는 표시용으로만 사용
  number: number;
  score: number;
  image?: string | null;
  region_meta?: any; // backend stores bbox meta
  created_at?: string;
  updated_at?: string;
};

/**
 * ✅ SSOT (backend):
 * GET /api/v1/exams/<exam_id>/questions/
 * - exam_id가 regular여도 서버가 template로 resolve하여 단일진실 문항을 반환
 */
export async function getExamQuestions(examId: number): Promise<SheetQuestionEntity[]> {
  if (!Number.isFinite(examId) || examId <= 0) return [];

  const res = await api.get(`/exams/${examId}/questions/`);
  const data = res.data;

  if (Array.isArray(data)) return data as SheetQuestionEntity[];
  if (Array.isArray(data?.items)) return data.items as SheetQuestionEntity[];
  if (Array.isArray(data?.results)) return data.results as SheetQuestionEntity[];
  return [];
}

/**
 * ✅ SSOT (backend):
 * PATCH /api/v1/exams/questions/<question_id>/
 * - 수정은 template + editable(derived regular 없음)일 때만 허용
 */
export async function patchQuestionScore(input: {
  questionId: number;
  score: number;
}): Promise<SheetQuestionEntity> {
  const res = await api.patch(`/exams/questions/${input.questionId}/`, {
    score: input.score,
  });
  return res.data as SheetQuestionEntity;
}
