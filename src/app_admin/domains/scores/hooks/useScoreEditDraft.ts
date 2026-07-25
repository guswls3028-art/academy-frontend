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
  isScoreEditLockedError,
  putScoreDraft,
  postScoreDraftCommit,
  resolvedScoreEditorClientId,
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
const LOCAL_DRAFT_KEY = (sessionId: number, clientId: string) =>
  `scores-local-draft:${sessionId}:${clientId}`;

function readLocalDraft(sessionId: number): PendingChange[] {
  const clientId = resolvedScoreEditorClientId();
  if (!clientId) return [];
  try {
    const value = JSON.parse(sessionStorage.getItem(LOCAL_DRAFT_KEY(sessionId, clientId)) ?? "[]");
    return Array.isArray(value) ? value as PendingChange[] : [];
  } catch {
    return [];
  }
}

function writeLocalDraft(sessionId: number, changes: PendingChange[]): void {
  const clientId = resolvedScoreEditorClientId();
  if (!clientId) return;
  try {
    if (changes.length > 0) {
      sessionStorage.setItem(LOCAL_DRAFT_KEY(sessionId, clientId), JSON.stringify(changes));
    } else {
      sessionStorage.removeItem(LOCAL_DRAFT_KEY(sessionId, clientId));
    }
  } catch {
    // 브라우저 저장소가 차단돼도 서버 draft 저장 경로는 계속 시도한다.
  }
}

export type DraftStatus = "idle" | "dirty" | "saving" | "saved" | "error";

type Options = {
  sessionId: number;
  panelRef: React.RefObject<SessionScoresPanelHandle | null>;
  isActive: boolean;
  checkForRecovery?: boolean;
};

export function useScoreEditDraft({ sessionId, panelRef, isActive, checkForRecovery = isActive }: Options) {
  const [draftStatus, setDraftStatus] = useState<DraftStatus>("idle");
  const [draftError, setDraftError] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [hasDraftToRestore, setHasDraftToRestore] = useState(false);
  const [isRecoveryCheckPending, setIsRecoveryCheckPending] = useState(
    checkForRecovery && Number.isFinite(sessionId),
  );
  const [recoveryCheckFailed, setRecoveryCheckFailed] = useState(false);
  const [editLockConflict, setEditLockConflict] = useState(false);
  const [isStartingEdit, setIsStartingEdit] = useState(false);
  const [recoveryCheckNonce, setRecoveryCheckNonce] = useState(0);
  const [restoreChanges, setRestoreChanges] = useState<PendingChange[]>([]);
  /** P0-3: 모달에 변경 건수를 표시해서 학원장이 "복원할 만한지" 즉시 판단. */
  const [restoreChangeCount, setRestoreChangeCount] = useState(0);
  const [isDiscardingDraft, setIsDiscardingDraft] = useState(false);
  const [hasPendingChanges, setHasPendingChanges] = useState(false);
  const savePromiseRef = useRef<Promise<number> | null>(null);
  const lastSaveAttemptAtRef = useRef(0);
  const needsDraftCommitRef = useRef(false);

  const saveNow = useCallback(async function savePendingScores(
    preservedPanel?: SessionScoresPanelHandle | null,
  ): Promise<number> {
    if (savePromiseRef.current) {
      const inFlight = savePromiseRef.current;
      const queuedPanel = preservedPanel ?? panelRef.current;
      const savedCount = await inFlight;
      if (savePromiseRef.current === inFlight) savePromiseRef.current = null;
      if ((queuedPanel?.getPendingSnapshot?.() ?? []).length > 0) {
        return savedCount + await savePendingScores(queuedPanel);
      }
      return savedCount;
    }

    const panel = preservedPanel ?? panelRef.current;
    const snapshot = panel?.getPendingSnapshot?.() ?? [];
    if (snapshot.length === 0) {
      if (needsDraftCommitRef.current) {
        setDraftStatus("saving");
        setDraftError(null);
        try {
          await postScoreDraftCommit(sessionId, false);
          needsDraftCommitRef.current = false;
          try { localStorage.removeItem(DRAFT_TS_KEY(sessionId)); } catch { /* ignore */ }
          writeLocalDraft(sessionId, []);
          setLastSavedAt(Date.now());
          setHasPendingChanges(false);
          setDraftStatus("saved");
        } catch (e) {
          setHasPendingChanges(true);
          setDraftStatus("error");
          setDraftError(e instanceof Error ? e.message : "성적 저장 마무리 실패");
          throw e;
        }
      }
      setHasPendingChanges(false);
      return 0;
    }

    setDraftStatus("saving");
    setDraftError(null);
    lastSaveAttemptAtRef.current = Date.now();

    const run = (async () => {
      try {
        await putScoreDraft(sessionId, snapshot);
        needsDraftCommitRef.current = true;
        try { localStorage.setItem(DRAFT_TS_KEY(sessionId), String(Date.now())); } catch { /* ignore */ }

        const savedCount = await panel?.flushPendingChanges?.() ?? 0;
        const remaining = panel?.getPendingSnapshot?.() ?? [];
        if (remaining.length === 0) {
          await postScoreDraftCommit(sessionId, false);
          needsDraftCommitRef.current = false;
          try { localStorage.removeItem(DRAFT_TS_KEY(sessionId)); } catch { /* ignore */ }
          writeLocalDraft(sessionId, []);
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
        writeLocalDraft(sessionId, panel?.getPendingSnapshot?.() ?? snapshot);
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
    const remaining = panel?.getPendingSnapshot?.() ?? [];
    if (remaining.length > 0) return savedCount + await savePendingScores(panel);
    return savedCount;
  }, [sessionId, panelRef]);

  const requestAutosave = useCallback(() => {
    if (!isActive) return;
    writeLocalDraft(sessionId, panelRef.current?.getPendingSnapshot?.() ?? []);
    setHasPendingChanges(true);
    setDraftStatus("dirty");
  }, [isActive, panelRef, sessionId]);

  // On score page enter: check for an existing recovery draft once.
  // P0-3 (2026-05-13): 1시간 넘게 방치된 draft 는 자동 commit(폐기)해서
  // 매 진입마다 "복원할까요?" 모달 노출되는 패턴 차단.
  useEffect(() => {
    if (!checkForRecovery || !Number.isFinite(sessionId)) {
      setIsRecoveryCheckPending(false);
      return;
    }
    let cancelled = false;
    setIsRecoveryCheckPending(true);
    setRecoveryCheckFailed(false);
    setEditLockConflict(false);
    getScoreDraft(sessionId)
      .then(async (data) => {
        if (cancelled) return;
        const localChanges = readLocalDraft(sessionId);
        const recoveryChanges = localChanges.length > 0 ? localChanges : data.changes;
        if (!recoveryChanges?.length) {
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
            await postScoreDraftCommit(sessionId, true);
            try { localStorage.removeItem(DRAFT_TS_KEY(sessionId)); } catch { /* ignore */ }
            writeLocalDraft(sessionId, []);
            if (!cancelled) setHasDraftToRestore(false);
          } catch {
            if (!cancelled) {
              setRestoreChanges(recoveryChanges);
              setRestoreChangeCount(recoveryChanges.length);
              setHasDraftToRestore(true);
              setDraftError("오래된 임시저장을 정리하지 못했습니다. 복원하거나 다시 버려 주세요.");
            }
          }
          return;
        }
        if (cancelled) return;
        setRestoreChanges(recoveryChanges);
        setRestoreChangeCount(recoveryChanges.length);
        setHasDraftToRestore(true);
        // tsUnknown 인 경우는 timestamp 누락 — 다음 폐기/commit 사이클까지는 모달 노출.
        void tsUnknown;
      })
      .catch((error) => {
        if (!cancelled) {
          if (isScoreEditLockedError(error)) {
            setHasDraftToRestore(false);
            setEditLockConflict(true);
            setRecoveryCheckFailed(false);
            return;
          }
          const localChanges = readLocalDraft(sessionId);
          if (localChanges.length > 0) {
            setRestoreChanges(localChanges);
            setRestoreChangeCount(localChanges.length);
            setHasDraftToRestore(true);
            setRecoveryCheckFailed(false);
            return;
          }
          setHasDraftToRestore(false);
          setRecoveryCheckFailed(true);
        }
      })
      .finally(() => {
        if (!cancelled) setIsRecoveryCheckPending(false);
      });
    return () => {
      cancelled = true;
    };
  }, [checkForRecovery, recoveryCheckNonce, sessionId]);

  const retryRecoveryCheck = useCallback(() => {
    setRecoveryCheckNonce((value) => value + 1);
  }, []);

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
      // contenteditable 타이핑 중에는 다자리 점수의 중간값(예: 74의 7)을 저장하지 않는다.
      // blur/Enter/Tab 등으로 셀이 확정된 뒤 idle 시간을 다시 계산한다.
      if (panelRef.current?.hasUncommittedActiveCell?.()) {
        lastSignature = signature;
        changedAt = now;
        setDraftStatus("dirty");
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

  const beginEditing = useCallback(async (): Promise<boolean> => {
    setIsStartingEdit(true);
    setDraftError(null);
    try {
      await putScoreDraft(sessionId, []);
      setEditLockConflict(false);
      return true;
    } catch (error) {
      if (isScoreEditLockedError(error)) setEditLockConflict(true);
      setDraftError(
        isScoreEditLockedError(error)
          ? "다른 화면에서 이 차시를 수정 중입니다."
          : "수정 준비에 실패했습니다.",
      );
      return false;
    } finally {
      setIsStartingEdit(false);
    }
  }, [sessionId]);

  const restoreDraft = useCallback(async (): Promise<boolean> => {
    const panel = panelRef.current;
    if (restoreChanges.length > 0 && panel == null) return false;
    setIsStartingEdit(true);
    setDraftError(null);
    try {
      await putScoreDraft(sessionId, restoreChanges);
      setEditLockConflict(false);
      needsDraftCommitRef.current = restoreChanges.length > 0;
      if (restoreChanges.length > 0) {
        panel?.applyDraftPatch?.(restoreChanges);
        setHasPendingChanges(true);
        setDraftStatus("dirty");
      }
      setHasDraftToRestore(false);
      setRestoreChanges([]);
      setRestoreChangeCount(0);
      return true;
    } catch (error) {
      if (isScoreEditLockedError(error)) setEditLockConflict(true);
      setDraftError(
        isScoreEditLockedError(error)
          ? "다른 화면에서 이 차시를 수정 중입니다."
          : "임시저장 복원 준비에 실패했습니다.",
      );
      return false;
    } finally {
      setIsStartingEdit(false);
    }
  }, [restoreChanges, panelRef, sessionId]);

  const discardDraft = useCallback(async (): Promise<boolean> => {
    setIsDiscardingDraft(true);
    setDraftError(null);
    try {
      await postScoreDraftCommit(sessionId, true);
      needsDraftCommitRef.current = false;
      try { localStorage.removeItem(DRAFT_TS_KEY(sessionId)); } catch { /* ignore */ }
      writeLocalDraft(sessionId, []);
      setHasDraftToRestore(false);
      setRestoreChanges([]);
      setRestoreChangeCount(0);
      return true;
    } catch (e) {
      setDraftError(e instanceof Error ? e.message : "임시저장을 버리지 못했습니다.");
      return false;
    } finally {
      setIsDiscardingDraft(false);
    }
  }, [sessionId]);

  const releaseEditLease = useCallback(async (): Promise<boolean> => {
    try {
      await postScoreDraftCommit(sessionId, true);
      setEditLockConflict(false);
      return true;
    } catch (error) {
      if (isScoreEditLockedError(error)) setEditLockConflict(true);
      setDraftStatus("error");
      setDraftError("입력 잠금 마무리에 실패했습니다. 다시 시도해 주세요.");
      return false;
    }
  }, [sessionId]);

  // 변경이 없는 긴 편집에서도 다른 직원/탭이 동시에 수정하지 않도록 lease를 갱신한다.
  useEffect(() => {
    if (!isActive) return;
    const interval = window.setInterval(() => {
      if (savePromiseRef.current != null) return;
      const snapshot = panelRef.current?.getPendingSnapshot?.() ?? [];
      if (snapshot.length > 0) return;
      void putScoreDraft(sessionId, []).catch((error) => {
        if (isScoreEditLockedError(error)) setEditLockConflict(true);
        setDraftStatus("error");
        setDraftError("수정 권한 유지에 실패했습니다. 저장 후 다시 시도해 주세요.");
      });
    }, 60_000);
    return () => window.clearInterval(interval);
  }, [isActive, panelRef, sessionId]);

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
      panelRef.current?.commitActiveCell?.();
      const snapshot = panelRef.current?.getPendingSnapshot?.() ?? [];
      if (snapshot.length === 0) return;
      writeLocalDraft(sessionId, snapshot);
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
    isRecoveryCheckPending,
    recoveryCheckFailed,
    editLockConflict,
    isStartingEdit,
    retryRecoveryCheck,
    restoreChangeCount,
    isDiscardingDraft,
    restoreDraft,
    discardDraft,
    beginEditing,
    releaseEditLease,
    saveNow,
    requestAutosave,
  };
}
