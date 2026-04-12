// src/app_student/domains/sessions/hooks/useStudentSessions.ts
/**
 * ✅ useStudentSessions
 */

import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { fetchMySessions, fetchSessionDetail } from "@student/domains/sessions/api/sessions.api";

export function useMySessions() {
  return useQuery({
    queryKey: ["student-sessions"],
    queryFn: fetchMySessions,
    staleTime: 60 * 1000,
    placeholderData: keepPreviousData,
  });
}

export function useSessionDetail(sessionId?: number) {
  const safeId = Number(sessionId);
  return useQuery({
    queryKey: ["student-session", safeId],
    queryFn: () => fetchSessionDetail(safeId),
    enabled: Number.isFinite(safeId),
    staleTime: 60 * 1000,
    placeholderData: keepPreviousData,
  });
}
