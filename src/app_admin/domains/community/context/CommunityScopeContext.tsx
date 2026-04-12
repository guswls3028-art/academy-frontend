// PATH: src/app_admin/domains/community/context/CommunityScopeContext.tsx
// 통합 | 강의별 | 세션별 scope + 선택된 강의/세션 (URL 쿼리와 동기화)

import { createContext, useContext, useMemo, useState, useEffect, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import type { CommunityScope } from "../api/community.api";

export type CommunityScopeContextValue = {
  scope: CommunityScope;
  setScope: (s: CommunityScope) => void;
  lectureId: number | null;
  setLectureId: (id: number | null) => void;
  sessionId: number | null;
  setSessionId: (id: number | null) => void;
  /** 현재 scope에 따른 실제 사용할 lectureId (통합이면 null, 강의/세션별이면 선택된 강의) */
  effectiveLectureId: number | null;
};

const CommunityScopeContext = createContext<CommunityScopeContextValue | null>(null);

export function CommunityScopeProvider({ children }: { children: ReactNode }) {
  const [searchParams] = useSearchParams();

  // URL에서 초기값 읽어 첫 렌더 불일치 방지
  const [scope, setScope] = useState<CommunityScope>(() => {
    const s = searchParams.get("scope");
    if (s === "lecture" || s === "session" || s === "all") return s;
    return "all";
  });
  const [lectureId, setLectureId] = useState<number | null>(() => {
    const lid = searchParams.get("lectureId");
    return lid && Number.isFinite(Number(lid)) ? Number(lid) : null;
  });
  const [sessionId, setSessionId] = useState<number | null>(() => {
    const sid = searchParams.get("sessionId");
    return sid && Number.isFinite(Number(sid)) ? Number(sid) : null;
  });

  // URL 쿼리와 동기화 (트리 선택 시 페이지에서 setSearchParams 호출 → 여기서 반영)
  useEffect(() => {
    const scopeParam = searchParams.get("scope") as CommunityScope | null;
    const lid = searchParams.get("lectureId");
    const sid = searchParams.get("sessionId");
    // scope 파라미터가 없으면 "all"로 리셋 — 탭 이동 시 이전 scope가 잔류하는 버그 방지
    if (scopeParam === "lecture" || scopeParam === "session" || scopeParam === "all") {
      setScope(scopeParam);
    } else {
      setScope("all");
    }
    if (lid != null && lid !== "" && Number.isFinite(Number(lid))) setLectureId(Number(lid));
    else setLectureId(null);
    if (sid != null && sid !== "" && Number.isFinite(Number(sid))) setSessionId(Number(sid));
    else setSessionId(null);
  }, [searchParams]);

  const effectiveLectureId = useMemo(() => {
    if (scope === "all") return null;
    return lectureId;
  }, [scope, lectureId]);

  const value = useMemo<CommunityScopeContextValue>(
    () => ({
      scope,
      setScope,
      lectureId,
      setLectureId,
      sessionId,
      setSessionId,
      effectiveLectureId,
    }),
    [scope, lectureId, sessionId, effectiveLectureId]
  );

  return (
    <CommunityScopeContext.Provider value={value}>
      {children}
    </CommunityScopeContext.Provider>
  );
}

export function useCommunityScope() {
  const ctx = useContext(CommunityScopeContext);
  if (!ctx) throw new Error("useCommunityScope must be used within CommunityScopeProvider");
  return ctx;
}
