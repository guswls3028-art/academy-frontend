// src/app_student/domains/exams/hooks/useMyExamResult.ts
/**
 * ✅ useMyExamResult (LOCK v1)
 */

import { useQuery } from "@tanstack/react-query";
import { fetchMyExamResult } from "@student/domains/exams/api/results";

export function useMyExamResult(examId?: number) {
  const safeId = Number(examId);

  return useQuery({
    queryKey: ["student", "exams", "result", safeId],
    queryFn: () => fetchMyExamResult(safeId),
    enabled: Number.isFinite(safeId),
  });
}
