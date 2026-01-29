/**
 * useExamDetail
 *
 * WHY:
 * - Batch1 Submissions 패널이 "exam 상세"를 간단히 소비할 수 있도록 래핑
 * - 기존 useExam 훅(LOCKED)을 존중하고, 추론/계산 없이 그대로 전달
 * - exams 도메인 범위 내에서만 제공 (새 endpoint 금지)
 */

import { useExam } from "./useExam";

export function useExamDetail(examId: number) {
  return useExam(examId);
}
