import { useCallback, useEffect, useState } from "react";
import useAuth from "@/auth/hooks/useAuth";
import { getTenantUserLocalKey } from "@/shared/utils/safeLocalStorage";
import { patchExamItemScore } from "@admin/domains/scores/api/patchItemScore";
import { appendSerialTask } from "../utils/serialSaveQueue";
import { readAuthTokenEnvelopeSafely } from "@/shared/auth/tokenSession";
import { getTenantCodeForApiRequest } from "@/shared/tenant";

export type AnswerEditChange = { questionId: number; score: number; answer?: string };
export type AnswerEditController = { flush: () => Promise<void>; hasPending: () => boolean };

// Preserve the same scoped queue across SPA unmounts when storage is blocked.
// This document-local recovery state is never an authority token.
type SharedQueue = {
  pending: { current: Map<number, AnswerEditChange> };
  queued: { current: Set<AnswerEditChange> };
  failed: { current: Set<AnswerEditChange> };
  tail: { current: Promise<void> };
  listeners: Set<() => void>;
};
const memoryDrafts = new Map<string, SharedQueue>();
const warnPendingExit = (event: BeforeUnloadEvent) => {
  if (memoryDrafts.size) { event.preventDefault(); event.returnValue = ""; }
};
function remember(key: string, queue: SharedQueue) {
  if (queue.pending.current.size || queue.queued.current.size) {
    memoryDrafts.set(key, queue);
    window.addEventListener("beforeunload", warnPendingExit);
  } else {
    if (memoryDrafts.get(key) === queue) memoryDrafts.delete(key);
    if (!memoryDrafts.size) window.removeEventListener("beforeunload", warnPendingExit);
  }
}

export function useAnswerEditQueue({ sessionId, examId, enrollmentId, questionIds, onSaveSuccess }: {
  sessionId?: number; examId: number; enrollmentId: number;
  questionIds: number[]; onSaveSuccess: () => void;
}) {
  const { user } = useAuth();
  const activeStorageKey = getTenantUserLocalKey(`answer-draft:${sessionId}:${examId}:${enrollmentId}`, user?.id);
  const [storageKey] = useState(activeStorageKey);
  const [initialGeneration] = useState(() => readAuthTokenEnvelopeSafely()?.generation);
  const [initialTenant] = useState(getTenantCodeForApiRequest);
  const [storageError, setStorageError] = useState("");
  const [restored] = useState<AnswerEditChange[]>(() => {
    try {
      const saved: unknown = storageKey
        ? (memoryDrafts.has(storageKey) ? [...memoryDrafts.get(storageKey)!.pending.current.values()]
          : JSON.parse(window.sessionStorage.getItem(storageKey) ?? "[]")) : [];
      return Array.isArray(saved) ? saved.filter((row): row is AnswerEditChange =>
        row != null && questionIds.includes(row.questionId) && Number.isFinite(row.score)
        && (row.answer == null || typeof row.answer === "string")) : [];
    } catch { return storageKey ? [...(memoryDrafts.get(storageKey)?.pending.current.values() ?? [])] : []; }
  });
  const [shared] = useState<SharedQueue>(() => (storageKey && memoryDrafts.get(storageKey)) || {
    pending: { current: new Map(restored.map((row) => [row.questionId, row])) },
    queued: { current: new Set() }, failed: { current: new Set(restored) },
    tail: { current: Promise.resolve() }, listeners: new Set(),
  });
  const { pending, queued, failed, tail } = shared;
  const [, renderQueue] = useState(0);
  const notify = useCallback(() => { shared.listeners.forEach((listener) => listener()); }, [shared]);
  useEffect(() => {
    const listener = () => renderQueue((value) => value + 1);
    shared.listeners.add(listener);
    return () => { shared.listeners.delete(listener); };
  }, [shared]);
  const [error, setError] = useState(restored.length > 0
    ? "저장하지 못한 답안을 복원했습니다. 확인한 뒤 다시 저장해 주세요." : "");
  const persist = useCallback(() => {
    if (!storageKey) {
      setStorageError("사용자별 복구 공간을 확인하지 못했습니다. 답안 저장을 마친 뒤 이동해 주세요.");
      return;
    }
    const changes = [...pending.current.values()];
    remember(storageKey, shared);
    try {
      const storage = window.sessionStorage;
      if (changes.length) {
        const serialized = JSON.stringify(changes);
        storage.setItem(storageKey, serialized);
        if (storage.getItem(storageKey) !== serialized) throw new Error("Answer draft readback failed");
      } else {
        storage.removeItem(storageKey);
        if (storage.getItem(storageKey) != null) throw new Error("Answer draft cleanup failed");
      }
      setStorageError("");
    } catch {
      setStorageError(changes.length
        ? "브라우저에 복구 답안을 보관하지 못했습니다. 입력은 현재 창에 남아 있습니다. 저장 전 새로고침하거나 창을 닫지 마세요."
        : "서버 저장은 완료됐지만 이 브라우저의 이전 복구 답안을 지우지 못했습니다.");
    }
  }, [pending, shared, storageKey]);
  const stage = useCallback((change: AnswerEditChange) => {
    pending.current.set(change.questionId, change);
    persist();
  }, [pending, persist]);
  const enqueue = useCallback((change: AnswerEditChange) => {
    if (queued.current.has(change)) return;
    const session = readAuthTokenEnvelopeSafely();
    const tenant = getTenantCodeForApiRequest();
    const currentStorageKey = getTenantUserLocalKey(`answer-draft:${sessionId}:${examId}:${enrollmentId}`, user?.id);
    let sameUser = currentStorageKey != null && currentStorageKey === storageKey && tenant === initialTenant;
    if (sameUser && session?.generation !== initialGeneration) {
      try {
        const claims = JSON.parse(atob(session!.access.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
        sameUser = String(claims.user_id ?? "") === String(user?.id ?? "");
      } catch { sameUser = false; }
    }
    const authScope = sameUser && session && tenant ? { generation: session.generation, tenant } : null;
    stage(change);
    queued.current.add(change);
    failed.current.delete(change);
    notify();
    tail.current = appendSerialTask(tail.current, async () => {
      if (sessionId == null) throw new Error("차시 성적 화면에서 수정해 주세요.");
      if (!authScope) throw new Error("입력을 시작한 계정으로 로그인한 뒤 다시 저장해 주세요.");
      return patchExamItemScore({ sessionId, examId, enrollmentId, ...change, authScope });
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
      if (storageKey) remember(storageKey, shared);
      notify();
      if (!pending.current.size) setError("");
    });
  }, [enrollmentId, examId, failed, initialGeneration, initialTenant, notify, onSaveSuccess, pending, persist, queued, sessionId, shared, stage, storageKey, tail, user?.id]);
  const flush = useCallback(async () => {
    for (const change of pending.current.values()) {
      if (!failed.current.has(change)) enqueue(change);
    }
    let waiting: Promise<void>;
    do { waiting = tail.current; await waiting; } while (waiting !== tail.current);
    if (pending.current.size) throw new Error("저장하지 못한 답안이 있습니다. 답안 창에서 다시 저장해 주세요.");
  }, [enqueue, failed, pending, tail]);
  const retry = useCallback(async () => {
    for (const change of pending.current.values()) enqueue(change);
    await flush();
  }, [enqueue, flush, pending]);
  const hasPending = useCallback(() => pending.current.size > 0 || queued.current.size > 0, [pending, queued]);
  return { restored, stage, enqueue, flush, retry, hasPending,
    isSaving: queued.current.size > 0, error: pending.current.size ? error : "", storageError };
}
