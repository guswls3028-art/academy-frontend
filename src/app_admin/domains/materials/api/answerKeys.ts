// ======================================================================================
// FILE: src/features/materials/api/answerKeys.ts  (SSOT ALIGN: exams/answer-keys/?exam=<exam_id>)
// ======================================================================================
import api from "@/shared/api/axios";
import axios from "axios";

export type AnswerKeyEntity = {
  id: number;
  exam: number; // ✅ backend: AnswerKey.exam = template Exam.id
  answers: Record<string, string>; // key=ExamQuestion.id (string), value=correct answer
  created_at?: string;
  updated_at?: string;
};

function normalizeArray(data: any): any[] {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.results)) return data.results;
  return [];
}

/**
 * ✅ SSOT (backend):
 * - list/retrieve: ?exam=<id> 로 접근 가능
 * - regular exam id를 넣어도 서버가 template로 resolve해서 단일진실 반환
 */
export async function getExamAnswerKey(examId: number): Promise<AnswerKeyEntity | null> {
  if (!Number.isFinite(examId) || examId <= 0) return null;

  try {
    const res = await api.get(`/exams/answer-keys/`, {
      params: { exam: examId },
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

/**
 * ✅ SSOT (backend):
 * - AnswerKey는 template exam에만 생성 가능
 * - 여기서는 caller가 template exam id를 넘기는 흐름(자료실=template list)로 사용
 */
export async function createAnswerKey(payload: {
  examId: number;
  answers: Record<string, string>;
}): Promise<AnswerKeyEntity> {
  const res = await api.post(`/exams/answer-keys/`, {
    exam: payload.examId,
    answers: payload.answers,
  });
  return res.data as AnswerKeyEntity;
}

export async function updateAnswerKey(payload: {
  id: number;
  examId: number;
  answers: Record<string, string>;
}): Promise<AnswerKeyEntity> {
  const res = await api.put(`/exams/answer-keys/${payload.id}/`, {
    exam: payload.examId,
    answers: payload.answers,
  });
  return res.data as AnswerKeyEntity;
}

export async function upsertExamAnswerKey(input: {
  examId: number;
  existingId?: number | null;
  answers: Record<string, string>;
}) {
  if (!Number.isFinite(input.examId) || input.examId <= 0) {
    throw new Error("유효하지 않은 examId");
  }

  if (input.existingId) {
    return await updateAnswerKey({
      id: input.existingId,
      examId: input.examId,
      answers: input.answers,
    });
  }

  return await createAnswerKey({
    examId: input.examId,
    answers: input.answers,
  });
}
