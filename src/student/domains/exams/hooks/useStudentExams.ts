// src/student/domains/exams/hooks/useStudentExams.ts
/**
 * ✅ useStudentExams / useStudentExam
 */

import { useQuery } from "@tanstack/react-query";
import { fetchStudentExam, fetchStudentExams } from "@/student/domains/exams/api/exams";

export function useStudentExams(params?: { session_id?: number }) {
  const sessionId = params?.session_id;
  const enabled = sessionId == null ? true : Number.isFinite(Number(sessionId));

  return useQuery({
    queryKey: ["student-exams", params ?? {}],
    queryFn: () => fetchStudentExams(params),
    enabled,
  });
}

export function useStudentExam(examId?: number) {
  const safeId = Number(examId);
  return useQuery({
    queryKey: ["student-exam", safeId],
    queryFn: () => fetchStudentExam(safeId),
    enabled: Number.isFinite(safeId),
  });
}
