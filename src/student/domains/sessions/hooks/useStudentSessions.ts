// src/student/domains/sessions/hooks/useStudentSessions.ts
/**
 * ✅ useStudentSessions
 */

import { useQuery } from "@tanstack/react-query";
import { fetchMySessions, fetchSessionDetail } from "@/student/domains/sessions/api/sessions";

export function useMySessions() {
  return useQuery({
    queryKey: ["student-sessions"],
    queryFn: fetchMySessions,
  });
}

export function useSessionDetail(sessionId?: number) {
  const safeId = Number(sessionId);
  return useQuery({
    queryKey: ["student-session", safeId],
    queryFn: () => fetchSessionDetail(safeId),
    enabled: Number.isFinite(safeId),
  });
}
