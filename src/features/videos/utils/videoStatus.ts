// PATH: src/features/videos/utils/videoStatus.ts
// Batch-only display labels. Backend status is source of truth.

import type { VideoStatus } from "../api/videos";

export const VIDEO_STATUS_LABEL: Record<VideoStatus, string> = {
  PENDING: "업로드 대기",
  UPLOADED: "제출",
  PROCESSING: "처리 중",
  READY: "완료",
  FAILED: "실패",
};

/** 공용 톤 SSOT: success(초록) | danger(빨강) | warning(노랑) | primary(강조) | neutral(회색) */
export const VIDEO_STATUS_TONE: Record<VideoStatus, "success" | "danger" | "warning" | "primary" | "neutral"> = {
  PENDING: "neutral",
  UPLOADED: "primary",
  PROCESSING: "warning",
  READY: "success",
  FAILED: "danger",
};
