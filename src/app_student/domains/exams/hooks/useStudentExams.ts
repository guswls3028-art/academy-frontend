// src/app_student/domains/exams/hooks/useStudentExams.ts
/**
 * ✅ useStudentExams / useStudentExam
 */

import { useQuery } from "@tanstack/react-query";
import { fetchStudentExam, fetchStudentExams } from "@student/domains/exams/api/exams.api";
import { studentExamQueryKeys } from "../queryKeys";

function responseStatus(error: unknown): number | undefined {
  const status = (error as { response?: { status?: unknown } })?.response?.status;
  return typeof status === "number" ? status : undefined;
}

function retryUnlessClientError(failureCount: number, error: unknown): boolean {
  const status = responseStatus(error);
  if (status != null && status >= 400 && status < 500) return false;
  return failureCount < 2;
}

export function useStudentExams(params?: { session_id?: number; include_upcoming?: boolean }) {
  const sessionId = params?.session_id;
  const enabled = sessionId == null ? true : Number.isFinite(Number(sessionId));

  return useQuery({
    queryKey: studentExamQueryKeys.list(params),
    queryFn: () => fetchStudentExams(params),
    enabled,
    retry: retryUnlessClientError,
  });
}

export function useStudentExam(examId?: number) {
  const safeId = Number(examId);
  return useQuery({
    queryKey: studentExamQueryKeys.detail(safeId),
    queryFn: () => fetchStudentExam(safeId),
    enabled: Number.isFinite(safeId),
    retry: retryUnlessClientError,
  });
}
