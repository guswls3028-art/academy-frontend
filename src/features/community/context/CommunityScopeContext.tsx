// PATH: src/features/community/context/CommunityScopeContext.tsx
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
  const [scope, setScope] = useState<CommunityScope>("all");
  const [lectureId, setLectureId] = useState<number | null>(null);
  const [sessionId, setSessionId] = useState<number | null>(null);

  // URL 쿼리와 동기화 (강의 목록에서 바로가기 등으로 진입 시)
  useEffect(() => {
    const scopeParam = searchParams.get("scope") as CommunityScope | null;
    const lid = searchParams.get("lectureId");
    const sid = searchParams.get("sessionId");
    if (scopeParam === "lecture" || scopeParam === "session" || scopeParam === "all") setScope(scopeParam);
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
