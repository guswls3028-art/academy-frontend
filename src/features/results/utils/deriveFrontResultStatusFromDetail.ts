/**
 * PATH: src/features/results/utils/deriveFrontResultStatusFromDetail.ts
 *
 * ✅ FrontResultStatus (Detail 기준 파생) - FINAL (오판 방지)
 *
 * 목적:
 * - StudentResultPanel(상세)에서 단일 상태 배지 표시
 *
 * 🔒 절대 규칙:
 * - 주관식 여부(is_editable)로 "미채점"을 추측하지 않는다.
 *   (만점이 아니면 미채점이라고 오판하는 운영 사고 방지)
 *
 * 백엔드가 detail에서 확정적으로 제공하는 신호만 사용:
 * - submitted_at
 * - attempt_id (대표 attempt 존재 여부)
 *
 * 참고:
 * - "미채점/후처리"는 list(row)의 clinic_required/submission_status로 표현하는 것이 안전.
 */

import type { FrontResultStatus } from "../types/frontResultStatus";
import type { ExamResultDetail } from "../api/adminExamResultDetail";

export function deriveFrontResultStatusFromDetail(detail: ExamResultDetail): FrontResultStatus {
  // 1) 제출 없음
  if (!detail.submitted_at) {
    return "waiting";
  }

  // 2) 대표 attempt 없음 → 비정상(운영 즉시 확인 필요)
  if (!detail.attempt_id) {
    return "failed";
  }

  // 3) 제출 있고 대표 attempt 있으면 일단 "완료"
  // - 미채점 여부는 여기서 추측 금지
  return "done";
}
