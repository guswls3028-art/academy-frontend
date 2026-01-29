// PATH: src/features/homework/hooks/useSessionEnrollments.ts
/**
 * useSessionEnrollments
 * - homework 도메인에서 “대상 학생 목록” 단일 진실 조회
 */

import { useQuery } from "@tanstack/react-query";
import { fetchSessionEnrollments } from "../api/sessionEnrollments";

export function useSessionEnrollments(sessionId: number) {
  return useQuery({
    queryKey: ["homework-session-enrollments", sessionId],
    queryFn: () => fetchSessionEnrollments(sessionId),
    enabled: Number.isFinite(sessionId) && sessionId > 0,
  });
}
