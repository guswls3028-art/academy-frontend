/**
 * PATH: src/features/results/types/frontResultStatus.ts
 *
 * ✅ FrontResultStatus (Frontend 전용 통합 상태)
 *
 * 목적:
 * - submission / result 정보를 하나의 UX 상태로 통합
 *
 * ❌ 금지:
 * - 점수 계산
 * - 합불 판단
 *
 * ✅ 원칙:
 * - backend가 내려준 값만 "조합"한다
 * - results 도메인 내부에서만 사용
 */

export type FrontResultStatus =
  | "waiting"        // 제출 없음
  | "processing"    // 채점 중
  | "partial_done"  // 주관식 미채점 등
  | "done"          // 완료
  | "failed";       // 실패
