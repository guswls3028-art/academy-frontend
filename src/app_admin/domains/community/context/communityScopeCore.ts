import { createContext } from "react";
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

export const CommunityScopeContext = createContext<CommunityScopeContextValue | null>(null);
