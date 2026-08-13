/**
 * PATH: src/features/results/utils/deriveFrontResultStatus.ts
 *
 * ✅ FrontResultStatus (Row 기준 파생) - LOCKED (Backend Contract Aligned)
 *
 * 목적:
 * - Admin 결과 리스트 Row에서 운영자가 이해 가능한 단일 상태 제공
 *
 * 우선 규칙:
 * - 백엔드 result_status를 그대로 사용
 * - 순차 배포 중 구버전 응답에만 제한된 호환 판정 적용
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
  const backendStatus = String(row.result_status ?? "").toUpperCase();
  if (backendStatus === "NOT_SUBMITTED") return "waiting";
  if (backendStatus === "PROCESSING") return "processing";
  if (backendStatus === "PARTIAL") return "partial_done";
  if (backendStatus === "DONE") return "done";
  if (backendStatus === "FAILED") return "failed";

  const raw = String(row.submission_status ?? "").toLowerCase().trim();

  /**
   * 1) 제출/상태 정보 자체가 없다
   * - 이 경우만 waiting (진짜 미제출/미생성 케이스)
   */
  if (!raw) {
    if (row.meta_status === "NOT_SUBMITTED") return "waiting";
    if (typeof row.final_score === "number" && Number.isFinite(row.final_score)) {
      return row.is_provisional ? "partial_done" : "done";
    }
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
  if (row.is_provisional) {
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
