import { useEffect, useRef, useState } from "react";

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
  isActive: boolean;
  activeCell: ScoreActiveCell | null;
  onPresenceError: (message: string, lockConflict: boolean) => void;
};

export function useScoreEditPresence({
  sessionId,
  panelRef,
  savePromiseRef,
  isActive,
  activeCell,
  onPresenceError,
}: Options) {
  const [activeEditors, setActiveEditors] = useState<ScoreActiveEditor[]>([]);
  const activeCellRef = useRef<ScoreActiveCell | null>(activeCell);
  const presencePromiseRef = useRef<Promise<void> | null>(null);
  activeCellRef.current = activeCell;

  useEffect(() => {
    if (!isActive) return;
    if (savePromiseRef.current != null) return;
    const snapshot = panelRef.current?.getPendingSnapshot?.() ?? [];
    // Pending score writes own the next draft PUT so presence cannot race them
    // and overwrite or consume the autosave result. saveNow includes activeCell.
    if (snapshot.length > 0) return;
    const request = putScoreDraft(sessionId, snapshot, { activeCell })
      .then((data) => setActiveEditors(data.active_editors))
      .catch((error) => {
        const locked = isScoreEditLockedError(error);
        onPresenceError(
          locked
            ? "다른 직원이 같은 과제 셀을 입력 중입니다. 표시된 셀을 확인해 주세요."
            : "선택한 셀의 협업 상태를 알리지 못했습니다.",
          locked,
        );
      });
    presencePromiseRef.current = request;
    void request.finally(() => {
      if (presencePromiseRef.current === request) presencePromiseRef.current = null;
    });
  }, [activeCell, isActive, onPresenceError, panelRef, savePromiseRef, sessionId]);

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

  useEffect(() => {
    if (!isActive) return;
    const interval = window.setInterval(() => {
      if (savePromiseRef.current != null) return;
      const snapshot = panelRef.current?.getPendingSnapshot?.() ?? [];
      if (snapshot.length > 0) return;
      const request = putScoreDraft(sessionId, [], { activeCell: activeCellRef.current })
        .then((data) => setActiveEditors(data.active_editors))
        .catch((error) => {
          onPresenceError(
            "수정 권한 유지에 실패했습니다. 저장 후 다시 시도해 주세요.",
            isScoreEditLockedError(error),
          );
        });
      presencePromiseRef.current = request;
      void request.finally(() => {
        if (presencePromiseRef.current === request) presencePromiseRef.current = null;
      });
    }, 60_000);
    return () => window.clearInterval(interval);
  }, [isActive, onPresenceError, panelRef, savePromiseRef, sessionId]);

  return { activeEditors, setActiveEditors, activeCellRef, presencePromiseRef };
}
