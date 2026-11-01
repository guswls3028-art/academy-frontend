import type { SubmitAnswersPayload } from "./exams.api";
import { getLocalItem, removeLocalItem, setLocalItem } from "@/shared/utils/safeLocalStorage";
import { createRandomUuid } from "@/shared/utils/randomUuid";

export type PendingExamSubmission = SubmitAnswersPayload & { client_request_id: string };
const storageKey = (draftKey: string) => `${draftKey}:submission`;

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

export function prepareExamSubmission(draftKey: string | null, payload: SubmitAnswersPayload): PendingExamSubmission {
  // Another tab may already have a request whose response was lost.
  const existing = readPendingExamSubmission(draftKey);
  if (existing) return existing;
  const attempt = { ...payload, client_request_id: createRandomUuid() };
  if (draftKey) setLocalItem(storageKey(draftKey), JSON.stringify(attempt));
  return attempt;
}

export function clearPendingExamSubmission(draftKey: string | null, requestId: string): boolean {
  if (draftKey && readPendingExamSubmission(draftKey)?.client_request_id === requestId) {
    removeLocalItem(storageKey(draftKey));
    return true;
  }
  return false;
}
