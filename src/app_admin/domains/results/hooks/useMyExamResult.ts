// PATH: src/app_admin/domains/results/hooks/useMyExamResult.ts
import { useQuery } from "@tanstack/react-query";
import { fetchMyExamResult } from "../api/myExamResult";

export function useMyExamResult(examId: number | undefined) {
  // ✅ 너가 강조한 패턴 그대로: examId 준비 전이면 요청 금지
  const safeId = Number(examId);
  const enabled = Number.isFinite(safeId);

  return useQuery({
    queryKey: ["my-exam-result", safeId],
    queryFn: () => fetchMyExamResult(safeId),
    enabled, // 🔥 필수: undefined/NaN일 때 404/UX깨짐 방지
  });
}
