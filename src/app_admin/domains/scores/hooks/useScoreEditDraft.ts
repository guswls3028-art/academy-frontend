// PATH: src/app_admin/domains/scores/hooks/useScoreEditDraft.ts
/**
 * Score edit autosave: live score persistence, recovery draft, status, beforeunload.
 * - A committed cell is persisted after a short idle delay.
 * - Ctrl+S consumers call saveNow for an immediate flush.
 * - The server draft is written before score patches so a failed save can be restored.
 */

import { useState, useRef, useEffect, useCallback } from "react";
import useAuth from "@/auth/hooks/useAuth";
import type { SessionScoresPanelHandle } from "../panels/SessionScoresPanel";
import {
  getScoreDraft,
  isScoreEditLockedError,
  isScoreEditStaleError,
  putScoreDraft,
  postScoreDraftCommit,
  resolvedScoreEditorRecoveryId,
  type PendingChange,
  type ScoreActiveCell,
  type ScoreActiveEditor,
} from "../api/scoreDraft";
import { blockAutoReload } from "@/shared/ui/layout/VersionChecker";
import {
  getLocalItem,
  getTenantUserLocalKey,
  removeLocalItem,
  setLocalItem,
} from "@/shared/utils/safeLocalStorage";
import {
  getSessionItem,
  removeSessionItem,
  setSessionItem,
} from "@/shared/utils/safeSessionStorage";

const AUTOSAVE_IDLE_MS = 900;
const AUTOSAVE_POLL_MS = 250;
const AUTOSAVE_RETRY_MS = 5_000;
/**
 * P0-3 (2026-05-13): 1시간 넘게 방치된 draft 는 자동 폐기.
 * 학원장이 "복원할까요?" 모달을 매 진입마다 보지 않게 하기 위함.
 * timestamp 는 localStorage 에 client-local 로 추적 (backend 에 시각 컬럼 없음).
 */
const DRAFT_STALE_MS = 60 * 60 * 1000;
function readLocalDraft(storageKey: string | null): PendingChange[] {
  if (!storageKey) return [];
  try {
    const value = JSON.parse(getSessionItem(storageKey) ?? "[]");
    return Array.isArray(value) ? value as PendingChange[] : [];
  } catch {
    return [];
  }
}

function writeLocalDraft(storageKey: string | null, changes: PendingChange[]): void {
  if (!storageKey) return;
  if (changes.length > 0) {
    setSessionItem(storageKey, JSON.stringify(changes));
  } else {
    removeSessionItem(storageKey);
  }
}

export type DraftStatus = "idle" | "dirty" | "saving" | "saved" | "error";

type Options = {
  sessionId: number;
  panelRef: React.RefObject<SessionScoresPanelHandle | null>;
  isActive: boolean;
  checkForRecovery?: boolean;
  activeCell?: ScoreActiveCell | null;
};

export function useScoreEditDraft({
  sessionId,
  panelRef,
  isActive,
  checkForRecovery = isActive,
  activeCell = null,
}: Options) {
  const { user } = useAuth();
  const draftTimestampKey = getTenantUserLocalKey(`scores-draft-ts:${sessionId}`, user?.id);
  const localDraftKey = getTenantUserLocalKey(
    `scores-local-draft:${sessionId}:${resolvedScoreEditorRecoveryId()}`,
    user?.id,
  );
  const [draftStatus, setDraftStatus] = useState<DraftStatus>("idle");
  const [draftError, setDraftError] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [hasDraftToRestore, setHasDraftToRestore] = useState(false);
  const [isRecoveryCheckPending, setIsRecoveryCheckPending] = useState(
    checkForRecovery && Number.isFinite(sessionId),
  );
  const [recoveryCheckFailed, setRecoveryCheckFailed] = useState(false);
  const [editLockConflict, setEditLockConflict] = useState(false);
  const [editStaleConflict, setEditStaleConflict] = useState(false);
  const [leaseReleaseFailed, setLeaseReleaseFailed] = useState(false);
  const [isStartingEdit, setIsStartingEdit] = useState(false);
  const [recoveryCheckNonce, setRecoveryCheckNonce] = useState(0);
  const [restoreChanges, setRestoreChanges] = useState<PendingChange[]>([]);
  /** P0-3: 모달에 변경 건수를 표시해서 학원장이 "복원할 만한지" 즉시 판단. */
  const [restoreChangeCount, setRestoreChangeCount] = useState(0);
  const [isDiscardingDraft, setIsDiscardingDraft] = useState(false);
  const [hasPendingChanges, setHasPendingChanges] = useState(false);
  const [activeEditors, setActiveEditors] = useState<ScoreActiveEditor[]>([]);
  const savePromiseRef = useRef<Promise<number> | null>(null);
  const lastSaveAttemptAtRef = useRef(0);
  const needsDraftCommitRef = useRef(false);
  const activeCellRef = useRef<ScoreActiveCell | null>(activeCell);
  activeCellRef.current = activeCell;

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
          if (draftTimestampKey) removeLocalItem(draftTimestampKey);
          writeLocalDraft(localDraftKey, []);
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
        const draftResponse = await putScoreDraft(sessionId, snapshot, {
          activeCell: activeCellRef.current,
        });
        setActiveEditors(draftResponse.active_editors);
        needsDraftCommitRef.current = true;
        if (draftTimestampKey) setLocalItem(draftTimestampKey, String(Date.now()));

        const savedCount = await panel?.flushPendingChanges?.() ?? 0;
        const remaining = panel?.getPendingSnapshot?.() ?? [];
        if (remaining.length === 0) {
          await postScoreDraftCommit(sessionId, false);
          needsDraftCommitRef.current = false;
          if (draftTimestampKey) removeLocalItem(draftTimestampKey);
          writeLocalDraft(localDraftKey, []);
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
        writeLocalDraft(localDraftKey, panel?.getPendingSnapshot?.() ?? snapshot);
        setHasPendingChanges(true);
        setDraftStatus("error");
        if (isScoreEditStaleError(e)) {
          setEditStaleConflict(true);
          setDraftError(
            "시험 제출 또는 다른 안전한 작업으로 서버 점수가 바뀌었습니다. 입력값은 보존했습니다. 새로고침 후 복원 여부를 확인해 주세요.",
          );
        } else {
          setDraftError(e instanceof Error ? e.message : "성적 저장 실패");
        }
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
  }, [draftTimestampKey, localDraftKey, panelRef, sessionId]);

  const requestAutosave = useCallback(() => {
    if (!isActive) return;
    writeLocalDraft(localDraftKey, panelRef.current?.getPendingSnapshot?.() ?? []);
    setHasPendingChanges(true);
    setDraftStatus("dirty");
  }, [isActive, localDraftKey, panelRef]);

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
    setEditStaleConflict(false);
    getScoreDraft(sessionId)
      .then(async (data) => {
        if (cancelled) return;
        setActiveEditors(data.active_editors);
        const localChanges = readLocalDraft(localDraftKey);
        const recoveryChanges = localChanges.length > 0 ? localChanges : data.changes;
        if (!recoveryChanges?.length) {
          if (data.stale) {
            try {
              await postScoreDraftCommit(sessionId, true);
              if (draftTimestampKey) removeLocalItem(draftTimestampKey);
              writeLocalDraft(localDraftKey, []);
            } catch {
              if (!cancelled) {
                setRecoveryCheckFailed(true);
                setDraftError("변경된 서버 점수의 편집 잠금을 정리하지 못했습니다. 다시 확인해 주세요.");
              }
            }
          }
          if (!cancelled) setHasDraftToRestore(false);
          return;
        }
        // stale 검사: localStorage 의 마지막 putScoreDraft timestamp 가 1시간 이전이면 자동 폐기.
        let lastTs = 0;
        try {
          const raw = draftTimestampKey ? getLocalItem(draftTimestampKey) : null;
          lastTs = raw ? Number(raw) : 0;
        } catch { /* ignore */ }
        const isStale = lastTs > 0 && Date.now() - lastTs > DRAFT_STALE_MS;
        const tsUnknown = lastTs === 0; // 다른 브라우저에서 저장된 케이스 — 모달은 띄우되 stale 처리는 X
        if (isStale) {
          try {
            await postScoreDraftCommit(sessionId, true);
            if (draftTimestampKey) removeLocalItem(draftTimestampKey);
            writeLocalDraft(localDraftKey, []);
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
        if (data.stale) {
          setEditStaleConflict(true);
          setDraftError(
            "임시저장 뒤 서버 점수가 변경되었습니다. 최신 성적표 위에 복원할 내용을 확인해 주세요.",
          );
        }
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
          const localChanges = readLocalDraft(localDraftKey);
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
  }, [checkForRecovery, draftTimestampKey, localDraftKey, recoveryCheckNonce, sessionId]);

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
      const data = await putScoreDraft(sessionId, [], {
        activeCell: activeCellRef.current,
      });
      setActiveEditors(data.active_editors);
      setEditLockConflict(false);
      setEditStaleConflict(false);
      setLeaseReleaseFailed(false);
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
      const data = await putScoreDraft(sessionId, restoreChanges, {
        acknowledgeStale: true,
        activeCell: activeCellRef.current,
      });
      setActiveEditors(data.active_editors);
      setEditLockConflict(false);
      setEditStaleConflict(false);
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
      if (draftTimestampKey) removeLocalItem(draftTimestampKey);
      writeLocalDraft(localDraftKey, []);
      setHasDraftToRestore(false);
      setEditStaleConflict(false);
      setLeaseReleaseFailed(false);
      setRestoreChanges([]);
      setRestoreChangeCount(0);
      return true;
    } catch (e) {
      setDraftError(e instanceof Error ? e.message : "임시저장을 버리지 못했습니다.");
      return false;
    } finally {
      setIsDiscardingDraft(false);
    }
  }, [draftTimestampKey, localDraftKey, sessionId]);

  const releaseEditLease = useCallback(async (): Promise<boolean> => {
    try {
      await postScoreDraftCommit(sessionId, true);
      setEditLockConflict(false);
      setLeaseReleaseFailed(false);
      return true;
    } catch (error) {
      if (isScoreEditLockedError(error)) setEditLockConflict(true);
      setLeaseReleaseFailed(true);
      setDraftStatus("error");
      setDraftError("입력 잠금 마무리에 실패했습니다. 다시 시도해 주세요.");
      return false;
    }
  }, [sessionId]);

  // 선택 셀을 즉시 알리고, 다른 편집자의 현재 선택은 짧은 조회로 갱신한다.
  useEffect(() => {
    if (!isActive) return;
    const snapshot = panelRef.current?.getPendingSnapshot?.() ?? [];
    void putScoreDraft(sessionId, snapshot, { activeCell })
      .then((data) => setActiveEditors(data.active_editors))
      .catch((error) => {
        setDraftStatus("error");
        setDraftError(
          isScoreEditLockedError(error)
            ? "다른 직원이 같은 과제 셀을 입력 중입니다. 표시된 셀을 확인해 주세요."
            : "선택한 셀의 협업 상태를 알리지 못했습니다.",
        );
      });
  }, [activeCell, isActive, panelRef, sessionId]);

  useEffect(() => {
    if (!isActive) {
      setActiveEditors([]);
      return;
    }
    const refresh = () => {
      void getScoreDraft(sessionId)
        .then((data) => setActiveEditors(data.active_editors))
        .catch(() => undefined);
    };
    const interval = window.setInterval(refresh, 4_000);
    return () => window.clearInterval(interval);
  }, [isActive, sessionId]);

  // 변경이 없는 긴 편집에서도 현재 브라우저의 lease를 갱신한다.
  useEffect(() => {
    if (!isActive) return;
    const interval = window.setInterval(() => {
      if (savePromiseRef.current != null) return;
      const snapshot = panelRef.current?.getPendingSnapshot?.() ?? [];
      if (snapshot.length > 0) return;
      void putScoreDraft(sessionId, [], { activeCell: activeCellRef.current })
        .then((data) => setActiveEditors(data.active_editors))
        .catch((error) => {
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
      writeLocalDraft(localDraftKey, snapshot);
      // 미저장 데이터가 있으면 항상 경고 (셀 수/경과 시간 무관)
      e.preventDefault();
      // 긴급 저장 시도 (브라우저가 허용하는 범위 내에서)
      try {
        void putScoreDraft(sessionId, snapshot, { activeCell: activeCellRef.current });
      } catch {
        // 저장 실패해도 경고는 이미 표시됨
      }
    };
    window.addEventListener("beforeunload", handler);

    return () => {
      window.removeEventListener("beforeunload", handler);
    };
  }, [isActive, localDraftKey, panelRef, sessionId]);

  return {
    draftStatus,
    draftError,
    lastSavedAt,
    hasPendingChanges,
    activeEditors,
    hasDraftToRestore,
    isRecoveryCheckPending,
    recoveryCheckFailed,
    editLockConflict,
    editStaleConflict,
    leaseReleaseFailed,
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
