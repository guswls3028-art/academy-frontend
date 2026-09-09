import { useCallback, useEffect, useRef, useState } from "react";

import type { SessionScoresPanelHandle } from "../panels/SessionScoresPanel";
import {
  getScoreDraft,
  isScoreEditLockedError,
  putScoreDraft,
  type ScoreActiveCell,
  type ScoreActiveEditor,
} from "../api/scoreDraft";

type Options = {
  sessionId: number;
  panelRef: React.RefObject<SessionScoresPanelHandle | null>;
  savePromiseRef: React.MutableRefObject<Promise<number> | null>;
  presencePausedRef: React.MutableRefObject<boolean>;
  isActive: boolean;
  activeCell: ScoreActiveCell | null;
  onPresenceError: (message: string, lockConflict: boolean) => void;
  onPresenceSuccess: () => void;
};

export function useScoreEditPresence({
  sessionId,
  panelRef,
  savePromiseRef,
  presencePausedRef,
  isActive,
  activeCell,
  onPresenceError,
  onPresenceSuccess,
}: Options) {
  const [activeEditors, setActiveEditors] = useState<ScoreActiveEditor[]>([]);
  const activeCellRef = useRef<ScoreActiveCell | null>(activeCell);
  const presencePromiseRef = useRef<Promise<void> | null>(null);
  const presenceQueueTailRef = useRef<Promise<void>>(Promise.resolve());
  const presenceRequestVersionRef = useRef(0);
  const presenceReadVersionRef = useRef(0);
  const sessionIdRef = useRef(sessionId);
  activeCellRef.current = activeCell;
  sessionIdRef.current = sessionId;

  const invalidatePresenceReads = useCallback(() => {
    presenceReadVersionRef.current += 1;
  }, []);

  const enqueuePresencePut = useCallback((
    requestVersion: number,
    requestActiveCell: ScoreActiveCell | null,
    failureMessage: string,
  ) => {
    const requestSessionId = sessionId;
    const predecessor = presenceQueueTailRef.current;
    const request = predecessor
      .catch(() => undefined)
      .then(async () => {
        try {
          const data = await putScoreDraft(requestSessionId, [], {
            activeCell: requestActiveCell,
          });
          if (
            requestVersion !== presenceRequestVersionRef.current
            || requestSessionId !== sessionIdRef.current
          ) return;
          setActiveEditors(data.active_editors);
          onPresenceSuccess();
        } catch (error) {
          if (
            requestVersion !== presenceRequestVersionRef.current
            || requestSessionId !== sessionIdRef.current
          ) return;
          const locked = isScoreEditLockedError(error);
          onPresenceError(
            locked
              ? "다른 직원이 같은 성적 셀을 입력 중입니다. 표시된 셀을 확인해 주세요."
              : failureMessage,
            locked,
          );
        }
      });
    presenceQueueTailRef.current = request;
    presencePromiseRef.current = request;
    void request.finally(() => {
      if (presencePromiseRef.current === request) presencePromiseRef.current = null;
    });
  }, [onPresenceError, onPresenceSuccess, sessionId]);

  useEffect(() => {
    const requestVersion = ++presenceRequestVersionRef.current;
    if (!isActive || presencePausedRef.current) return;
    if (savePromiseRef.current != null) return;
    const snapshot = panelRef.current?.getPendingSnapshot?.() ?? [];
    // Pending score writes own the next draft PUT so presence cannot race them
    // and overwrite or consume the autosave result. saveNow includes activeCell.
    if (snapshot.length > 0) return;
    enqueuePresencePut(
      requestVersion,
      activeCell,
      "선택한 셀의 협업 상태를 알리지 못했습니다.",
    );
  }, [activeCell, enqueuePresencePut, isActive, panelRef, presencePausedRef, savePromiseRef]);

  useEffect(() => {
    if (!isActive) {
      presenceReadVersionRef.current += 1;
      setActiveEditors([]);
      return;
    }
    const requestSessionId = sessionId;
    const refresh = () => {
      if (
        presencePausedRef.current
        || savePromiseRef.current != null
        || presencePromiseRef.current != null
      ) return;
      const readVersion = ++presenceReadVersionRef.current;
      const mutationVersion = presenceRequestVersionRef.current;
      void getScoreDraft(sessionId)
        .then((data) => {
          if (
            readVersion !== presenceReadVersionRef.current
            || mutationVersion !== presenceRequestVersionRef.current
            || requestSessionId !== sessionIdRef.current
            || presencePausedRef.current
          ) return;
          setActiveEditors(data.active_editors);
        })
        .catch(() => undefined);
    };
    const interval = window.setInterval(refresh, 4_000);
    return () => {
      presenceReadVersionRef.current += 1;
      window.clearInterval(interval);
    };
  }, [isActive, presencePausedRef, savePromiseRef, sessionId]);

  useEffect(() => {
    if (!isActive) return;
    const interval = window.setInterval(() => {
      if (presencePausedRef.current) return;
      if (savePromiseRef.current != null) return;
      const snapshot = panelRef.current?.getPendingSnapshot?.() ?? [];
      if (snapshot.length > 0) return;
      const requestVersion = ++presenceRequestVersionRef.current;
      enqueuePresencePut(
        requestVersion,
        activeCellRef.current,
        "수정 권한 유지에 실패했습니다. 저장 후 다시 시도해 주세요.",
      );
    }, 60_000);
    return () => window.clearInterval(interval);
  }, [enqueuePresencePut, isActive, panelRef, presencePausedRef, savePromiseRef]);

  return {
    activeEditors,
    setActiveEditors,
    activeCellRef,
    presencePromiseRef,
    invalidatePresenceReads,
  };
}
