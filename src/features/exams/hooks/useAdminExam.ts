//src/features/exams/hooks/useAdminExam.ts

import { useQuery } from "@tanstack/react-query";
import { fetchAdminExam } from "../api/adminExam";

/**
 * ✅ 관리자 시험 상세 조회 훅
 * - examId 준비 전엔 요청 ❌
 */
export function useAdminExam(examId?: number) {
  const safeId = Number(examId);

  return useQuery({
    queryKey: ["admin-exam", safeId],
    queryFn: () => fetchAdminExam(safeId),
    enabled: Number.isFinite(safeId),
  });
}
