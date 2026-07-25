// PATH: src/app_admin/domains/scores/hooks/useScoreEditDraft.ts
/**
 * Score edit autosave: live score persistence, recovery draft, status, beforeunload.
 * - A committed cell is persisted after a short idle delay.
 * - Ctrl+S consumers call saveNow for an immediate flush.
 * - The server draft is written before score patches so a failed save can be restored.
 */

import { useState, useRef, useEffect, useCallback } from "react";
import type { SessionScoresPanelHandle } from "../panels/SessionScoresPanel";
import {
  getScoreDraft,
  putScoreDraft,
  postScoreDraftCommit,
  type PendingChange,
} from "../api/scoreDraft";
import { blockAutoReload } from "@/shared/ui/layout/VersionChecker";

const AUTOSAVE_IDLE_MS = 900;
const AUTOSAVE_POLL_MS = 250;
const AUTOSAVE_RETRY_MS = 5_000;
/**
 * P0-3 (2026-05-13): 1시간 넘게 방치된 draft 는 자동 폐기.
 * 학원장이 "복원할까요?" 모달을 매 진입마다 보지 않게 하기 위함.
 * timestamp 는 localStorage 에 client-local 로 추적 (backend 에 시각 컬럼 없음).
 */
const DRAFT_STALE_MS = 60 * 60 * 1000;
const DRAFT_TS_KEY = (sessionId: number) => `scores-draft-ts:${sessionId}`;

export type DraftStatus = "idle" | "dirty" | "saving" | "saved" | "error";

type Options = {
  sessionId: number;
  panelRef: React.RefObject<SessionScoresPanelHandle | null>;
  isActive: boolean;
};

export function useScoreEditDraft({ sessionId, panelRef, isActive }: Options) {
  const [draftStatus, setDraftStatus] = useState<DraftStatus>("idle");
  const [draftError, setDraftError] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [hasDraftToRestore, setHasDraftToRestore] = useState(false);
  const [restoreChanges, setRestoreChanges] = useState<PendingChange[]>([]);
  /** P0-3: 모달에 변경 건수를 표시해서 학원장이 "복원할 만한지" 즉시 판단. */
  const [restoreChangeCount, setRestoreChangeCount] = useState(0);
  const [hasPendingChanges, setHasPendingChanges] = useState(false);
  const savePromiseRef = useRef<Promise<number> | null>(null);
  const lastSaveAttemptAtRef = useRef(0);

  const saveNow = useCallback(async function savePendingScores(): Promise<number> {
    if (savePromiseRef.current) {
      const inFlight = savePromiseRef.current;
      const savedCount = await inFlight;
      if (savePromiseRef.current === inFlight) savePromiseRef.current = null;
      if ((panelRef.current?.getPendingSnapshot?.() ?? []).length > 0) {
        return savedCount + await savePendingScores();
      }
      return savedCount;
    }

    const snapshot = panelRef.current?.getPendingSnapshot?.() ?? [];
    if (snapshot.length === 0) {
      setHasPendingChanges(false);
      return 0;
    }

    setDraftStatus("saving");
    setDraftError(null);
    lastSaveAttemptAtRef.current = Date.now();

    const run = (async () => {
      try {
        await putScoreDraft(sessionId, snapshot);
        try { localStorage.setItem(DRAFT_TS_KEY(sessionId), String(Date.now())); } catch { /* ignore */ }

        const savedCount = await panelRef.current?.flushPendingChanges?.() ?? 0;
        const remaining = panelRef.current?.getPendingSnapshot?.() ?? [];
        if (remaining.length === 0) {
          await postScoreDraftCommit(sessionId);
          try { localStorage.removeItem(DRAFT_TS_KEY(sessionId)); } catch { /* ignore */ }
          const savedAt = Date.now();
          lastSaveAttemptAtRef.current = 0;
          setLastSavedAt(savedAt);
          setHasPendingChanges(false);
          setDraftStatus("saved");
        } else {
          lastSaveAttemptAtRef.current = 0;
          setHasPendingChanges(true);
          setDraftStatus("dirty");
        }
        return savedCount;
      } catch (e) {
        setHasPendingChanges(true);
        setDraftStatus("error");
        setDraftError(e instanceof Error ? e.message : "성적 저장 실패");
        throw e;
      }
    })();

    savePromiseRef.current = run;
    let savedCount = 0;
    try {
      savedCount = await run;
    } finally {
      if (savePromiseRef.current === run) savePromiseRef.current = null;
    }
    const remaining = panelRef.current?.getPendingSnapshot?.() ?? [];
    if (remaining.length > 0) return savedCount + await savePendingScores();
    return savedCount;
  }, [sessionId, panelRef]);

  // On score page enter: check for an existing recovery draft once.
  // P0-3 (2026-05-13): 1시간 넘게 방치된 draft 는 자동 commit(폐기)해서
  // 매 진입마다 "복원할까요?" 모달 노출되는 패턴 차단.
  useEffect(() => {
    if (!isActive || !Number.isFinite(sessionId)) return;
    let cancelled = false;
    getScoreDraft(sessionId)
      .then(async (data) => {
        if (cancelled) return;
        if (!data.changes?.length) {
          setHasDraftToRestore(false);
          return;
        }
        // stale 검사: localStorage 의 마지막 putScoreDraft timestamp 가 1시간 이전이면 자동 폐기.
        let lastTs = 0;
        try {
          const raw = localStorage.getItem(DRAFT_TS_KEY(sessionId));
          lastTs = raw ? Number(raw) : 0;
        } catch { /* ignore */ }
        const isStale = lastTs > 0 && Date.now() - lastTs > DRAFT_STALE_MS;
        const tsUnknown = lastTs === 0; // 다른 브라우저에서 저장된 케이스 — 모달은 띄우되 stale 처리는 X
        if (isStale) {
          try {
            await postScoreDraftCommit(sessionId);
            try { localStorage.removeItem(DRAFT_TS_KEY(sessionId)); } catch { /* ignore */ }
          } catch { /* ignore */ }
          if (!cancelled) setHasDraftToRestore(false);
          return;
        }
        if (cancelled) return;
        setRestoreChanges(data.changes);
        setRestoreChangeCount(data.changes.length);
        setHasDraftToRestore(true);
        // tsUnknown 인 경우는 timestamp 누락 — 다음 폐기/commit 사이클까지는 모달 노출.
        void tsUnknown;
      })
      .catch(() => {
        if (!cancelled) setHasDraftToRestore(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isActive, sessionId]);

  // Live autosave after the pending snapshot stays unchanged for a short idle window.
  useEffect(() => {
    if (!isActive) return;
    let lastSignature = "";
    let changedAt = 0;
    const interval = setInterval(() => {
      const snapshot = panelRef.current?.getPendingSnapshot?.() ?? [];
      const signature = JSON.stringify(snapshot);
      const now = Date.now();
      const hasPending = snapshot.length > 0;
      setHasPendingChanges((current) => current === hasPending ? current : hasPending);

      if (!hasPending) {
        lastSignature = "";
        changedAt = 0;
        return;
      }
      if (signature !== lastSignature) {
        lastSignature = signature;
        changedAt = now;
        setDraftStatus("dirty");
        return;
      }
      if (
        now - changedAt >= AUTOSAVE_IDLE_MS &&
        now - lastSaveAttemptAtRef.current >= AUTOSAVE_RETRY_MS &&
        savePromiseRef.current == null
      ) {
        void saveNow().catch(() => undefined);
      }
    }, AUTOSAVE_POLL_MS);
    return () => clearInterval(interval);
  }, [isActive, panelRef, saveNow]);

  const restoreDraft = useCallback(() => {
    if (restoreChanges.length > 0) {
      panelRef.current?.applyDraftPatch?.(restoreChanges);
      setHasPendingChanges(true);
      setDraftStatus("dirty");
    }
    setHasDraftToRestore(false);
    setRestoreChanges([]);
    setRestoreChangeCount(0);
  }, [restoreChanges, panelRef]);

  const discardDraft = useCallback(async () => {
    try {
      await postScoreDraftCommit(sessionId);
      try { localStorage.removeItem(DRAFT_TS_KEY(sessionId)); } catch { /* ignore */ }
    } finally {
      setHasDraftToRestore(false);
      setRestoreChanges([]);
      setRestoreChangeCount(0);
    }
  }, [sessionId]);

  // Pending changes block deployment auto-reload only while data is actually dirty.
  useEffect(() => {
    if (!isActive || !hasPendingChanges) return;
    const unblock = blockAutoReload();
    return unblock;
  }, [isActive, hasPendingChanges]);

  useEffect(() => {
    if (!isActive) return;
    // beforeunload: 미저장 변경이 있으면 항상 경고 + 긴급 저장 시도
    const handler = (e: BeforeUnloadEvent) => {
      const snapshot = panelRef.current?.getPendingSnapshot?.() ?? [];
      if (snapshot.length === 0) return;
      // 미저장 데이터가 있으면 항상 경고 (셀 수/경과 시간 무관)
      e.preventDefault();
      // 긴급 저장 시도 (브라우저가 허용하는 범위 내에서)
      try {
        void putScoreDraft(sessionId, snapshot);
      } catch {
        // 저장 실패해도 경고는 이미 표시됨
      }
    };
    window.addEventListener("beforeunload", handler);

    return () => {
      window.removeEventListener("beforeunload", handler);
    };
  }, [isActive, panelRef, sessionId]);

  return {
    draftStatus,
    draftError,
    lastSavedAt,
    hasPendingChanges,
    hasDraftToRestore,
    restoreChangeCount,
    restoreDraft,
    discardDraft,
    saveNow,
  };
}
