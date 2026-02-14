/**
 * PATH: src/features/results/constants/frontResultStatusMaps.ts
 *
 * ✅ FrontResultStatus UI 규격
 *
 * - 모든 성적/제출 화면에서 이 규격만 사용
 *
 * UX 계약(운영 기준):
 * - partial_done은 "부분 완료" 같은 애매한 단어 금지 → "미채점/후처리"로 고정
 */

import type { FrontResultStatus } from "../types/frontResultStatus";

export const FRONT_RESULT_STATUS_LABEL: Record<FrontResultStatus, string> = {
  waiting: "미제출",
  processing: "채점중",
  partial_done: "미채점",
  done: "완료",
  failed: "실패",
};

export const FRONT_RESULT_STATUS_COLOR: Record<FrontResultStatus, string> = {
  waiting: "gray",
  processing: "yellow",
  partial_done: "blue",
  done: "green",
  failed: "red",
};

/** 공용 톤 SSOT: success | danger | warning | primary | neutral */
export const FRONT_RESULT_STATUS_TONE: Record<FrontResultStatus, "success" | "danger" | "warning" | "primary" | "neutral"> = {
  waiting: "neutral",
  processing: "warning",
  partial_done: "primary",
  done: "success",
  failed: "danger",
};
