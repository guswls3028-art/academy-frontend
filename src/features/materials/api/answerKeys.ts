// ======================================================================================
// FILE: src/features/materials/api/answerKeys.ts  (ADD)
// ======================================================================================
import api from "@/shared/api/axios";
import axios from "axios";

export type AnswerKeyEntity = {
  id: number;
  exam: number; // 서버 필드 유지 (sheetId와 동일한 컨텍스트)
  answers: Record<string, string>;
  created_at?: string;
  updated_at?: string;
};

function normalizeArray(data: any): any[] {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.results)) return data.results;
  return [];
}

export async function getSheetAnswerKey(sheetId: number): Promise<AnswerKeyEntity | null> {
  if (!Number.isFinite(sheetId) || sheetId <= 0) return null;

  try {
    const res = await api.get(`/exams/answer-keys/`, {
      params: { exam: sheetId },
    });

    const arr = normalizeArray(res.data);
    const first = arr?.[0];
    if (!first) return null;
    return first as AnswerKeyEntity;
  } catch (err: any) {
    if (axios.isAxiosError(err) && err.response?.status === 404) {
      return null;
    }
    throw err;
  }
}

export async function createAnswerKey(payload: {
  sheetId: number;
  answers: Record<string, string>;
}): Promise<AnswerKeyEntity> {
  const res = await api.post(`/exams/answer-keys/`, {
    exam: payload.sheetId,
    answers: payload.answers,
  });
  return res.data as AnswerKeyEntity;
}

export async function updateAnswerKey(payload: {
  id: number;
  sheetId: number;
  answers: Record<string, string>;
}): Promise<AnswerKeyEntity> {
  const res = await api.put(`/exams/answer-keys/${payload.id}/`, {
    exam: payload.sheetId,
    answers: payload.answers,
  });
  return res.data as AnswerKeyEntity;
}

export async function upsertSheetAnswerKey(input: {
  sheetId: number;
  existingId?: number | null;
  answers: Record<string, string>;
}) {
  if (!Number.isFinite(input.sheetId) || input.sheetId <= 0) {
    throw new Error("유효하지 않은 sheetId");
  }

  if (input.existingId) {
    return await updateAnswerKey({
      id: input.existingId,
      sheetId: input.sheetId,
      answers: input.answers,
    });
  }

  return await createAnswerKey({
    sheetId: input.sheetId,
    answers: input.answers,
  });
}
