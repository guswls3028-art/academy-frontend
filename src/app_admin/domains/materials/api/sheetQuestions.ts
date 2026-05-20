// ======================================================================================
// FILE: src/features/materials/api/sheetQuestions.ts  (SSOT ALIGN: /exams/<exam_id>/questions/)
// ======================================================================================
import api from "@/shared/api/axios";
import {
  isApiRecord,
  listFromApiResponse,
  numberFromApiValue,
  stringFromApiValue,
} from "./normalizers";

export type SheetQuestionEntity = {
  id: number;
  sheet: number; // backend ExamQuestion.sheet (Sheet.id) — 프론트에서는 표시용으로만 사용
  number: number;
  score: number;
  image?: string | null;
  region_meta?: Record<string, unknown> | null; // backend stores bbox meta
  created_at?: string;
  updated_at?: string;
};

function normalizeQuestion(value: unknown): SheetQuestionEntity | null {
  if (!isApiRecord(value)) return null;
  const id = numberFromApiValue(value.id);
  const sheet = numberFromApiValue(value.sheet);
  const number = numberFromApiValue(value.number);
  const score = numberFromApiValue(value.score);
  if (!id || !sheet || !number || score === null) return null;

  return {
    id,
    sheet,
    number,
    score,
    image: stringFromApiValue(value.image),
    region_meta: isApiRecord(value.region_meta) ? value.region_meta : null,
    created_at: stringFromApiValue(value.created_at) ?? undefined,
    updated_at: stringFromApiValue(value.updated_at) ?? undefined,
  };
}

/**
 * ✅ SSOT (backend):
 * GET /api/v1/exams/<exam_id>/questions/
 * - exam_id가 regular여도 서버가 template로 resolve하여 단일진실 문항을 반환
 */
export async function getExamQuestions(examId: number): Promise<SheetQuestionEntity[]> {
  if (!Number.isFinite(examId) || examId <= 0) return [];

  const res = await api.get(`/exams/${examId}/questions/`);
  return listFromApiResponse(res.data)
    .map(normalizeQuestion)
    .filter((question): question is SheetQuestionEntity => question !== null);
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
  const data = normalizeQuestion(res.data);
  if (!data) throw new Error("문항 배점 수정 실패");
  return data;
}
