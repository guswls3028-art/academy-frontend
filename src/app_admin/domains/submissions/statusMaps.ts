// PATH: src/app_admin/domains/submissions/statusMaps.ts
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
  superseded: "대체됨",
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
  superseded: "gray",
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
  superseded: "neutral",
  graded: "success",
  pending: "neutral",
  processing: "primary",
};

export function formatSubmissionDate(iso: string): string {
  if (!iso) return "";
  const date = new Date(iso);
  return `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

export function formatSubmissionFileSize(bytes?: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}
