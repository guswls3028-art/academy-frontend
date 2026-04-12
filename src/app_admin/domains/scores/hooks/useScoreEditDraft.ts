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
    } catch (e) {
      setDraftStatus("error");
      setDraftError(e instanceof Error ? e.message : "임시저장 실패");
    }
  }, [sessionId, panelRef]);

  // On edit mode enter: check for existing draft once
  useEffect(() => {
    if (!isEditMode || !Number.isFinite(sessionId)) return;
    let cancelled = false;
    getScoreDraft(sessionId)
      .then((data) => {
        if (cancelled || !data.changes?.length) return;
        setRestoreChanges(data.changes);
        setHasDraftToRestore(true);
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
  }, [restoreChanges, panelRef]);

  const discardDraft = useCallback(async () => {
    try {
      await postScoreDraftCommit(sessionId);
    } finally {
      setHasDraftToRestore(false);
      setRestoreChanges([]);
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
    restoreDraft,
    discardDraft,
    performSave,
  };
}
