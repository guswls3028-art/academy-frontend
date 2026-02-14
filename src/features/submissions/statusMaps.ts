// PATH: src/features/submissions/statusMaps.ts
import type { SubmissionStatus } from "./types";

/** 구형 API용 fallback 포함 (pending/processing 제거 시 삭제) */
export const SUBMISSION_STATUS_LABEL: Record<SubmissionStatus | "graded" | "pending" | "processing", string> = {
  submitted: "업로드됨",
  dispatched: "작업 큐 등록",
  extracting: "인식 중",
  needs_identification: "식별 필요",
  answers_ready: "답안 생성됨",
  grading: "채점 중",
  done: "완료",
  failed: "실패",
  graded: "채점 완료",
  pending: "대기",
  processing: "처리 중",
};

export const SUBMISSION_STATUS_COLOR: Record<SubmissionStatus | "graded" | "pending" | "processing", string> = {
  submitted: "gray",
  dispatched: "blue",
  extracting: "indigo",
  needs_identification: "yellow",
  answers_ready: "yellow",
  grading: "yellow",
  done: "green",
  failed: "red",
  graded: "green",
  pending: "gray",
  processing: "blue",
};

/** 공용 톤 SSOT: success | danger | warning | primary | neutral (하드코딩 색상 대신 사용) */
export const SUBMISSION_STATUS_TONE: Record<SubmissionStatus | "graded" | "pending" | "processing", "success" | "danger" | "warning" | "primary" | "neutral"> = {
  submitted: "neutral",
  dispatched: "primary",
  extracting: "primary",
  needs_identification: "warning",
  answers_ready: "warning",
  grading: "warning",
  done: "success",
  failed: "danger",
  graded: "success",
  pending: "neutral",
  processing: "primary",
};
