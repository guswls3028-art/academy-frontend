// PATH: src/features/submissions/statusMaps.ts
import type { SubmissionStatus } from "./types";

export const SUBMISSION_STATUS_LABEL: Record<SubmissionStatus | "graded", string> = {
  submitted: "업로드됨",
  dispatched: "작업 큐 등록",
  extracting: "인식 중",
  needs_identification: "식별 필요", // ✅ 추가
  answers_ready: "답안 생성됨",
  grading: "채점 중",
  done: "완료",
  failed: "실패",
  graded: "채점 완료",
};

export const SUBMISSION_STATUS_COLOR: Record<SubmissionStatus | "graded", string> = {
  submitted: "gray",
  dispatched: "blue",
  extracting: "indigo",
  needs_identification: "yellow", // ✅ 추가(주의)
  answers_ready: "yellow",
  grading: "yellow",
  done: "green",
  failed: "red",
  graded: "green",
};
