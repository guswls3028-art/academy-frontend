// src/app_student/domains/exams/hooks/useMyExamResultItems.ts
/**
 * ✅ useMyExamResultItems (LOCK v1)
 */

import { useQuery } from "@tanstack/react-query";
import { fetchMyExamResultItems } from "@student/domains/exams/api/results";

export function useMyExamResultItems(examId?: number) {
  const safeId = Number(examId);

  return useQuery({
    queryKey: ["student", "exams", "result", "items", safeId],
    queryFn: () => fetchMyExamResultItems(safeId),
    enabled: Number.isFinite(safeId),
  });
}
