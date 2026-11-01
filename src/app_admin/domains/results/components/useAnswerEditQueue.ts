import { useCallback, useRef, useState } from "react";
import useAuth from "@/auth/hooks/useAuth";
import { getTenantUserLocalKey } from "@/shared/utils/safeLocalStorage";
import { getSessionItem, setSessionItem, removeSessionItem } from "@/shared/utils/safeSessionStorage";
import { patchExamItemScore } from "@admin/domains/scores/api/patchItemScore";
import { appendSerialTask } from "../utils/serialSaveQueue";

export type AnswerEditChange = { questionId: number; score: number; answer?: string };
export type AnswerEditController = { flush: () => Promise<void>; hasPending: () => boolean };

export function useAnswerEditQueue({ sessionId, examId, enrollmentId, questionIds, onSaveSuccess }: {
  sessionId?: number; examId: number; enrollmentId: number;
  questionIds: number[]; onSaveSuccess: () => void;
}) {
  const { user } = useAuth();
  const storageKey = getTenantUserLocalKey(`answer-draft:${sessionId}:${examId}:${enrollmentId}`, user?.id);
  const [restored] = useState<AnswerEditChange[]>(() => {
    try {
      const saved: unknown = storageKey ? JSON.parse(getSessionItem(storageKey) ?? "[]") : [];
      return Array.isArray(saved) ? saved.filter((row): row is AnswerEditChange =>
        row != null && questionIds.includes(row.questionId) && Number.isFinite(row.score)
        && (row.answer == null || typeof row.answer === "string")) : [];
    } catch { return []; }
  });
  const pending = useRef(new Map(restored.map((row) => [row.questionId, row])));
  const queued = useRef(new Set<AnswerEditChange>());
  const failed = useRef(new Set(restored));
  const tail = useRef<Promise<void>>(Promise.resolve());
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(restored.length > 0
    ? "저장하지 못한 답안을 복원했습니다. 확인한 뒤 다시 저장해 주세요." : "");
  const persist = useCallback(() => {
    if (!storageKey) return;
    if (pending.current.size) setSessionItem(storageKey, JSON.stringify([...pending.current.values()]));
    else removeSessionItem(storageKey);
  }, [storageKey]);
  const stage = useCallback((change: AnswerEditChange) => {
    pending.current.set(change.questionId, change);
    persist();
  }, [persist]);
  const enqueue = useCallback((change: AnswerEditChange) => {
    if (queued.current.has(change)) return;
    stage(change);
    queued.current.add(change);
    failed.current.delete(change);
    setIsSaving(true);
    tail.current = appendSerialTask(tail.current, async () => {
      if (sessionId == null) throw new Error("차시 성적 화면에서 수정해 주세요.");
      return patchExamItemScore({ sessionId, examId, enrollmentId, ...change });
    }, () => {
      if (pending.current.get(change.questionId) === change) pending.current.delete(change.questionId);
      failed.current.delete(change);
      persist();
      onSaveSuccess();
    }, () => {
      failed.current.add(change);
      setError("저장하지 못한 답안이 있습니다. 입력값을 유지했습니다.");
    }).then(() => {
      queued.current.delete(change);
      setIsSaving(queued.current.size > 0);
      if (!pending.current.size) setError("");
    });
  }, [enrollmentId, examId, onSaveSuccess, persist, sessionId, stage]);
  const flush = useCallback(async () => {
    for (const change of pending.current.values()) {
      if (!failed.current.has(change)) enqueue(change);
    }
    let waiting: Promise<void>;
    do { waiting = tail.current; await waiting; } while (waiting !== tail.current);
    if (pending.current.size) throw new Error("저장하지 못한 답안이 있습니다. 답안 창에서 다시 저장해 주세요.");
  }, [enqueue]);
  const retry = useCallback(async () => {
    for (const change of pending.current.values()) enqueue(change);
    await flush();
  }, [enqueue, flush]);
  const hasPending = useCallback(() => pending.current.size > 0 || queued.current.size > 0, []);
  return { restored, stage, enqueue, flush, retry, hasPending, isSaving, error };
}
