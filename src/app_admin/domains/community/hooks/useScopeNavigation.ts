// PATH: src/app_admin/domains/community/hooks/useScopeNavigation.ts
// 트리 셀렉트 콜백 공통화 — selectAll/selectLecture/selectSession + URL sync

import { useCallback } from "react";
import { useSearchParams } from "react-router-dom";

interface Options {
  /** 선택 변경 시 추가 사이드 이펙트 (예: setShowCreate(false)) */
  onChange?: () => void;
}

export function useScopeNavigation(options: Options = {}) {
  const [, setSearchParams] = useSearchParams();
  const { onChange } = options;

  const selectAll = useCallback(() => {
    onChange?.();
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("scope", "all");
      next.delete("lectureId");
      next.delete("sessionId");
      return next;
    });
  }, [setSearchParams, onChange]);

  const selectLecture = useCallback(
    (lecId: number) => {
      onChange?.();
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set("scope", "lecture");
        next.set("lectureId", String(lecId));
        next.delete("sessionId");
        return next;
      });
    },
    [setSearchParams, onChange],
  );

  const selectSession = useCallback(
    (lecId: number, sesId: number) => {
      onChange?.();
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set("scope", "session");
        next.set("lectureId", String(lecId));
        next.set("sessionId", String(sesId));
        return next;
      });
    },
    [setSearchParams, onChange],
  );

  return { selectAll, selectLecture, selectSession };
}
