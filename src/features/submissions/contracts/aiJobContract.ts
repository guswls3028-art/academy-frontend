/**
 * AI Job 상태 계약 (백엔드와 동일 enum)
 * @see docs/FRONTEND_AI_CONTRACT_REFACTOR_REQUEST.md
 * Contract Versioning 적용. 변경 시 문서·버전 공지 필요.
 */
export const AI_JOB_STATUS = [
  "PENDING",
  "VALIDATING",
  "RUNNING",
  "DONE",
  "FAILED",
  "REJECTED_BAD_INPUT",
  "FALLBACK_TO_GPU",
  "RETRYING",
  "REVIEW_REQUIRED",
] as const;

export type AIJobStatus = (typeof AI_JOB_STATUS)[number];

/** Lite/Basic에서는 FAILED, REVIEW_REQUIRED 미사용 */
export const AI_JOB_STATUS_LABEL: Record<AIJobStatus, string> = {
  PENDING: "처리 대기",
  VALIDATING: "업로드 검증 중",
  RUNNING: "분석 중",
  DONE: "완료",
  FAILED: "분석 실패",
  REJECTED_BAD_INPUT: "조건 미충족",
  FALLBACK_TO_GPU: "고급 분석 중",
  RETRYING: "재시도 중",
  REVIEW_REQUIRED: "조교 검토 필요",
};

export const AI_JOB_STATUS_COLOR: Record<AIJobStatus, string> = {
  PENDING: "gray",
  VALIDATING: "blue",
  RUNNING: "indigo",
  DONE: "green",
  FAILED: "red",
  REJECTED_BAD_INPUT: "amber",
  FALLBACK_TO_GPU: "purple",
  RETRYING: "yellow",
  REVIEW_REQUIRED: "orange",
};

/** Pre-Validation 거부 코드 (백엔드와 동일) */
export const REJECTION_CODES = [
  "RESOLUTION_TOO_LOW",
  "FILE_TOO_LARGE",
  "VIDEO_TOO_LONG",
  "BLUR_OR_SHAKE",
  "TOO_DARK",
  "INVALID_FORMAT",
  "OMR_PHOTO_NOT_ALLOWED",
] as const;

export type RejectionCode = (typeof REJECTION_CODES)[number];

/** rejection_code → 사용자 노출 문구 */
export const REJECTION_MESSAGE: Record<RejectionCode, string> = {
  RESOLUTION_TOO_LOW: "해상도가 낮습니다. 더 선명하게 촬영해 주세요.",
  FILE_TOO_LARGE: "파일 크기가 제한을 초과했습니다.",
  VIDEO_TOO_LONG: "동영상 길이 제한을 초과했습니다.",
  BLUR_OR_SHAKE: "흔들리거나 흐릿합니다. 고정해서 다시 촬영해 주세요.",
  TOO_DARK: "너무 어둡습니다. 밝은 곳에서 촬영해 주세요.",
  INVALID_FORMAT: "지원하지 않는 파일 형식입니다.",
  OMR_PHOTO_NOT_ALLOWED:
    "Basic 요금제에서는 스캔된 OMR만 가능합니다. 촬영물은 Premium에서 이용해 주세요.",
};

export function getRejectionMessage(code: string | null | undefined): string {
  if (!code) return "입력 조건을 확인해 주세요.";
  return REJECTION_MESSAGE[code as RejectionCode] ?? "입력 조건을 확인해 주세요.";
}

/** 제출 응답: 거부 시 (job 미생성) */
export type SubmitRejectedResponse = {
  ok: false;
  job_id: null;
  type: string;
  error: string;
  rejection_code?: string | null;
};
