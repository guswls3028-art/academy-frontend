// ======================================================================================
// FILE: src/features/materials/api/answerKeys.ts  (SSOT ALIGN: exams/answer-keys/?exam=<exam_id>)
// ======================================================================================
import api, { isApiErrorStatus } from "@/shared/api/axios";
import {
  isApiRecord,
  listFromApiResponse,
  numberFromApiValue,
  stringFromApiValue,
} from "./normalizers";

export type AnswerKeyEntity = {
  id: number;
  exam: number; // ✅ backend: AnswerKey.exam = template Exam.id
  answers: Record<string, string>; // key=ExamQuestion.id (string), value=correct answer
  created_at?: string;
  updated_at?: string;
};

function normalizeAnswers(value: unknown): Record<string, string> {
  if (!isApiRecord(value)) return {};
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, answer]) =>
        typeof answer === "string" ||
        typeof answer === "number" ||
        typeof answer === "boolean" ||
        Array.isArray(answer)
      )
      .map(([key, answer]) => [
        key,
        Array.isArray(answer)
          ? answer.map((item) => String(item ?? "").trim()).filter(Boolean).join(",")
          : String(answer),
      ]),
  );
}

function normalizeAnswerKey(value: unknown): AnswerKeyEntity | null {
  if (!isApiRecord(value)) return null;
  const id = numberFromApiValue(value.id);
  const exam = numberFromApiValue(value.exam);
  if (!id || !exam || id <= 0 || exam <= 0) return null;

  return {
    id,
    exam,
    answers: normalizeAnswers(value.answers),
    created_at: stringFromApiValue(value.created_at) ?? undefined,
    updated_at: stringFromApiValue(value.updated_at) ?? undefined,
  };
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

    const first = listFromApiResponse(res.data).map(normalizeAnswerKey).find((item) => item !== null);
    return first ?? null;
  } catch (err: unknown) {
    if (isApiErrorStatus(err, 404)) {
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
  const data = normalizeAnswerKey(res.data);
  if (!data) throw new Error("정답 저장 실패");
  return data;
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
  const data = normalizeAnswerKey(res.data);
  if (!data) throw new Error("정답 수정 실패");
  return data;
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
