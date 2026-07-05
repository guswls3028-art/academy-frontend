// src/app_student/domains/exams/hooks/useMyExamResultItems.ts
/**
 * ✅ useMyExamResultItems (LOCK v1)
 */

import { useQuery } from "@tanstack/react-query";
import { fetchMyExamResultItems } from "@student/domains/exams/api/results";
import { studentExamQueryKeys } from "../queryKeys";

export function useMyExamResultItems(examId?: number) {
  const safeId = Number(examId);

  return useQuery({
    queryKey: studentExamQueryKeys.resultItems(safeId),
    queryFn: () => fetchMyExamResultItems(safeId),
    enabled: Number.isFinite(safeId),
  });
}
