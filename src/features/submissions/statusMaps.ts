// src/features/submissions/statusMaps.ts

import type { SubmissionStatus } from "./types";

/**
 * ✅ Submission status label/color maps
 * - submissions 도메인이 소유
 * - exams/results/sessions에서 가져다 쓰면 됨
 */

export const SUBMISSION_STATUS_LABEL: Record<SubmissionStatus, string> = {
  submitted: "업로드됨",
  dispatched: "작업 큐 등록",
  extracting: "인식 중",
  answers_ready: "답안 생성됨",
  grading: "채점 중",
  done: "완료",
  failed: "실패",
};

export const SUBMISSION_STATUS_COLOR: Record<SubmissionStatus, string> = {
  submitted: "gray",
  dispatched: "blue",
  extracting: "indigo",
  answers_ready: "yellow",
  grading: "yellow",
  done: "green",
  failed: "red",
};
