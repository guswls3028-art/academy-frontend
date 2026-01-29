// src/features/submissions/hooks/useSubmissionPolling.ts
// --------------------------------------------------
// Submission 상태 Polling 공통 훅 (⭐ 핵심)
// --------------------------------------------------
//
// 이 훅 하나로:
// - 학생 업로드 진행 상태
// - 관리자 재처리 상태
// - 영상 분석 상태
// 전부 동일 UX로 처리 가능
//

import { useQuery } from "@tanstack/react-query";
import { fetchSubmission } from "../api";
import { Submission } from "../types";

const TERMINAL_STATUS = ["done", "failed"] as const;

/**
 * ✅ Submission 상태 자동 추적 훅
 *
 * - 2초 간격 polling
 * - done / failed 도달 시 자동 중단
 */
export function useSubmissionPolling(
  submissionId?: number,
  enabled: boolean = true
) {
  return useQuery<Submission>({
    queryKey: ["submission", submissionId],
    queryFn: () => fetchSubmission(submissionId!),

    enabled: enabled && Number.isFinite(submissionId),

    refetchInterval: (data) => {
      if (!data) return 2000;
      return TERMINAL_STATUS.includes(data.status)
        ? false
        : 2000;
    },
  });
}
