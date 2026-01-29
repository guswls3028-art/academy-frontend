/**
 * PATH: src/features/results/utils/deriveFrontResultStatus.ts
 *
 * ✅ FrontResultStatus (Row 기준 파생) - LOCKED (Backend Contract Aligned)
 *
 * 목적:
 * - Admin 결과 리스트 Row에서 운영자가 이해 가능한 단일 상태 제공
 *
 * 🔒 절대 규칙:
 * - 프론트 계산 ❌
 * - 프론트 추측 ❌
 * - 점수/문항/attempt 직접 해석 ❌
 *
 * 사용 신호(backend 계약):
 * - submission_status (필수로 신뢰)
 * - clinic_required (후처리/미채점/검수 필요 신호)
 *
 * 레거시 호환:
 * - submission_id가 오는 환경도 있으나, 없다고 해서 waiting 처리하면 안 됨.
 */

import type { FrontResultStatus } from "../types/frontResultStatus";
import type { AdminExamResultRow } from "../types/results.types";

export function deriveFrontResultStatus(row: AdminExamResultRow): FrontResultStatus {
  const raw = String(row.submission_status ?? "").toLowerCase().trim();

  /**
   * 1) 제출/상태 정보 자체가 없다
   * - 이 경우만 waiting (진짜 미제출/미생성 케이스)
   */
  if (!raw) {
    // 레거시: submission_id가 있으면 제출로 간주
    if (row.submission_id) return "processing";
    return "waiting";
  }

  /**
   * 2) 명확한 실패
   */
  if (["failed", "error"].includes(raw)) {
    return "failed";
  }

  /**
   * 3) 파이프라인 진행 중
   */
  if (
    [
      "pending",
      "submitted",
      "dispatched",
      "extracting",
      "answers_ready",
      "grading",
      "running",
      "processing",
    ].includes(raw)
  ) {
    return "processing";
  }

  /**
   * 4) 결과는 있으나 후처리/검수 필요
   */
  if (row.clinic_required) {
    return "partial_done";
  }

  /**
   * 5) 최종 확정
   */
  if (["done", "completed", "success"].includes(raw)) {
    return "done";
  }

  /**
   * 6) 알 수 없는 상태 값 방어
   * - 운영 UX상 "processing"으로 두는 게 안전 (미제출로 오판 금지)
   */
  return "processing";
}
