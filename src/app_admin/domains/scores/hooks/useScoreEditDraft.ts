// PATH: src/app_admin/domains/scores/hooks/useScoreEditDraft.ts
/**
 * Score edit draft: autosave, recovery prompt, status, beforeunload.
 * - Draft autosave when 12+ cells changed OR every 40s (whichever first).
 * - GET draft on edit-mode enter → show restore prompt if present.
 * - beforeunload when dirty and not recently saved.
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

const AUTOSAVE_CELL_THRESHOLD = 12;
const AUTOSAVE_INTERVAL_MS = 40_000;
/**
 * P0-3 (2026-05-13): 1시간 넘게 방치된 draft 는 자동 폐기.
 * 학원장이 "복원할까요?" 모달을 매 진입마다 보지 않게 하기 위함.
 * timestamp 는 localStorage 에 client-local 로 추적 (backend 에 시각 컬럼 없음).
 */
const DRAFT_STALE_MS = 60 * 60 * 1000;
const DRAFT_TS_KEY = (sessionId: number) => `scores-draft-ts:${sessionId}`;

export type DraftStatus = "idle" | "saving" | "saved" | "error";

type Options = {
  sessionId: number;
  panelRef: React.RefObject<SessionScoresPanelHandle | null>;
  isEditMode: boolean;
};

export function useScoreEditDraft({ sessionId, panelRef, isEditMode }: Options) {
  const [draftStatus, setDraftStatus] = useState<DraftStatus>("idle");
  const [draftError, setDraftError] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [hasDraftToRestore, setHasDraftToRestore] = useState(false);
  const [restoreChanges, setRestoreChanges] = useState<PendingChange[]>([]);
  /** P0-3: 모달에 변경 건수를 표시해서 학원장이 "복원할 만한지" 즉시 판단. */
  const [restoreChangeCount, setRestoreChangeCount] = useState(0);

  const lastAutosaveAtRef = useRef<number>(0);
  const checkDraftOnEnterRef = useRef(false);

  const performSave = useCallback(async () => {
    const snapshot = panelRef.current?.getPendingSnapshot?.();
    if (!snapshot?.length) return;
    setDraftStatus("saving");
    setDraftError(null);
    try {
      await putScoreDraft(sessionId, snapshot);
      lastAutosaveAtRef.current = Date.now();
      setLastSavedAt(Date.now());
      setDraftStatus("saved");
      try { localStorage.setItem(DRAFT_TS_KEY(sessionId), String(Date.now())); } catch { /* ignore */ }
    } catch (e) {
      setDraftStatus("error");
      setDraftError(e instanceof Error ? e.message : "임시저장 실패");
    }
  }, [sessionId, panelRef]);

  // On edit mode enter: check for existing draft once.
  // P0-3 (2026-05-13): 1시간 넘게 방치된 draft 는 자동 commit(폐기)해서
  // 매 진입마다 "복원할까요?" 모달 노출되는 패턴 차단.
  useEffect(() => {
    if (!isEditMode || !Number.isFinite(sessionId)) return;
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
  }, [isEditMode, sessionId]);

  // Autosave: by count (12+) or by interval (40s)
  useEffect(() => {
    if (!isEditMode || !panelRef.current) return;
    const interval = setInterval(() => {
      const snapshot = panelRef.current?.getPendingSnapshot?.() ?? [];
      const now = Date.now();
      const elapsed = now - lastAutosaveAtRef.current;
      if (
        snapshot.length >= AUTOSAVE_CELL_THRESHOLD ||
        (snapshot.length > 0 && elapsed >= AUTOSAVE_INTERVAL_MS)
      ) {
        void performSave();
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [isEditMode, panelRef, performSave]);

  const restoreDraft = useCallback(() => {
    if (restoreChanges.length > 0) panelRef.current?.applyDraftPatch?.(restoreChanges);
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

  // 편집 모드 중 자동 리로드 차단 + beforeunload
  useEffect(() => {
    if (!isEditMode) return;

    // 배포 자동 리로드 차단
    const unblock = blockAutoReload();

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
      unblock(); // 편집 모드 해제 시 자동 리로드 허용
    };
  }, [isEditMode, draftStatus, panelRef]);

  return {
    draftStatus,
    draftError,
    lastSavedAt,
    hasDraftToRestore,
    restoreChangeCount,
    restoreDraft,
    discardDraft,
    performSave,
  };
}
