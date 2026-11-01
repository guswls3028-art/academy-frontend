import type { SubmitAnswersPayload } from "./exams.api";
import { getLocalItem, requireLocalStorage } from "@/shared/utils/safeLocalStorage";
import { createRandomUuid } from "@/shared/utils/randomUuid";

export type PendingExamSubmission = SubmitAnswersPayload & { client_request_id: string };
const storageKey = (draftKey: string) => `${draftKey}:submission`;

export class ExamSubmissionStorageError extends Error {
  constructor() {
    super("답안과 제출 요청을 이 브라우저에 안전하게 저장하지 못했습니다. 이 화면을 유지한 채 저장 공간·브라우저 설정을 확인하고 다시 제출해 주세요.");
  }
}

export class PendingExamSubmissionConflict extends Error {
  constructor(readonly pending: PendingExamSubmission) {
    super("다른 화면에서 먼저 제출한 답안이 있습니다. 이 화면의 답안은 보관했습니다. 먼저 제출한 답안의 결과를 확인해 주세요.");
  }
}

export function sameExamAnswers(left: SubmitAnswersPayload["answers"], right: SubmitAnswersPayload["answers"]): boolean {
  const ordered = (rows: SubmitAnswersPayload["answers"]) => JSON.stringify(
    [...rows].sort((a, b) => a.exam_question_id - b.exam_question_id),
  );
  return ordered(left) === ordered(right);
}

export function preserveExamAnswerDraft(draftKey: string | null, answers: Record<number, string>): void {
  try {
    if (!draftKey) throw new ExamSubmissionStorageError();
    const storage = requireLocalStorage();
    const serialized = JSON.stringify(answers);
    storage.setItem(draftKey, serialized);
    if (storage.getItem(draftKey) !== serialized) throw new ExamSubmissionStorageError();
  } catch { throw new ExamSubmissionStorageError(); }
}

export function readPendingExamSubmission(draftKey: string | null): PendingExamSubmission | null {
  if (!draftKey) return null;
  try {
    const value: unknown = JSON.parse(getLocalItem(storageKey(draftKey)) ?? "null");
    if (!value || typeof value !== "object") return null;
    const candidate = value as Partial<PendingExamSubmission>;
    if (typeof candidate.client_request_id !== "string" || !Array.isArray(candidate.answers)
      || !candidate.answers.every((row) => Number.isInteger(row.exam_question_id) && typeof row.answer === "string")) return null;
    return candidate as PendingExamSubmission;
  } catch { return null; }
}

export function prepareExamSubmission(draftKey: string | null, payload: SubmitAnswersPayload): {
  attempt: PendingExamSubmission; existing: boolean;
} {
  try {
    if (!draftKey) throw new ExamSubmissionStorageError();
    const storage = requireLocalStorage();
    const raw = storage.getItem(storageKey(draftKey));
    const existing = readPendingExamSubmission(draftKey);
    if (raw !== null && !existing) throw new ExamSubmissionStorageError();
    if (existing) {
      if (!sameExamAnswers(existing.answers, payload.answers)
        || existing.expected_attempt_count !== payload.expected_attempt_count) {
        throw new PendingExamSubmissionConflict(existing);
      }
      return { attempt: existing, existing: true };
    }
    const attempt = { ...payload, client_request_id: createRandomUuid() };
    const serialized = JSON.stringify(attempt);
    storage.setItem(storageKey(draftKey), serialized);
    if (storage.getItem(storageKey(draftKey)) !== serialized) throw new ExamSubmissionStorageError();
    return { attempt, existing: false };
  } catch (error) {
    if (error instanceof PendingExamSubmissionConflict) throw error;
    throw new ExamSubmissionStorageError();
  }
}

export function clearPendingExamSubmission(draftKey: string | null, requestId: string): boolean {
  try {
    if (draftKey && readPendingExamSubmission(draftKey)?.client_request_id === requestId) {
      const storage = requireLocalStorage();
      storage.removeItem(storageKey(draftKey));
      return storage.getItem(storageKey(draftKey)) === null;
    }
  } catch { /* A failed cleanup must never authorize deleting an answer draft. */ }
  return false;
}
