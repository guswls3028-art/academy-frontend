// ======================================================================================
// FILE: src/features/materials/api/sheetQuestions.ts  (ADD)
// ======================================================================================
import api from "@/shared/api/axios";

export type SheetQuestionEntity = {
  id: number;
  sheet: number;
  number: number;
  score: number;
  image?: string | null;
  region_meta?: any;
  created_at?: string;
  updated_at?: string;
};

export async function getSheetQuestions(sheetId: number): Promise<SheetQuestionEntity[]> {
  if (!Number.isFinite(sheetId) || sheetId <= 0) return [];

  const res = await api.get(`/exams/${sheetId}/questions/`);
  const data = res.data;

  if (Array.isArray(data)) return data as SheetQuestionEntity[];
  if (Array.isArray(data?.items)) return data.items as SheetQuestionEntity[];
  if (Array.isArray(data?.results)) return data.results as SheetQuestionEntity[];
  return [];
}

export async function patchSheetQuestionScore(input: { questionId: number; score: number }): Promise<SheetQuestionEntity> {
  const res = await api.patch(`/exams/questions/${input.questionId}/`, {
    score: input.score,
  });
  return res.data as SheetQuestionEntity;
}
