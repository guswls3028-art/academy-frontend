import type { SubmissionStatus } from "@/shared/api/contracts/submissions";

type DisplayStatus = SubmissionStatus | "graded" | "pending" | "processing";

/** 제출함·시험 상세는 PC 기준의 동일한 처리 상태를 표시한다. */
export const SUBMISSION_STATUS_LABEL: Record<DisplayStatus, string> = {
  submitted: "업로드됨", dispatched: "작업 큐 등록", extracting: "인식 중",
  needs_identification: "식별 필요", answers_ready: "답안 생성됨", grading: "채점 중",
  done: "완료", failed: "실패", superseded: "대체됨",
  graded: "채점 완료", pending: "대기", processing: "처리 중",
};

export const SUBMISSION_STATUS_TONE: Record<DisplayStatus, "success" | "danger" | "warning" | "primary" | "neutral"> = {
  submitted: "neutral", dispatched: "primary", extracting: "primary",
  needs_identification: "warning", answers_ready: "warning", grading: "warning",
  done: "success", failed: "danger", superseded: "neutral",
  graded: "success", pending: "neutral", processing: "primary",
};
