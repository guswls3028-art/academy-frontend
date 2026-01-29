// --------------------------------------------------
// Submission 공통 타입 (Backend 1:1 계약)
// --------------------------------------------------

export type SubmissionStatus =
  | "submitted"
  | "dispatched"
  | "extracting"
  | "answers_ready"
  | "grading"
  | "done"
  | "failed";

export type SubmissionSource =
  | "omr_scan"
  | "omr_manual"
  | "online"
  | "homework_image"
  | "homework_video"
  | "ai_match";

export type SubmissionTargetType =
  | "exam"
  | "homework";

/**
 * ✅ Backend Submission 모델과 1:1 대응
 * ❗ 이 타입 기준으로 polling / retry / admin UX 전부 동작
 */
export type Submission = {
  id: number;

  enrollment_id: number | null;

  target_type: SubmissionTargetType;
  target_id: number;

  source: SubmissionSource;
  status: SubmissionStatus;

  file_key?: string | null;
  file_type?: string | null;
  file_size?: number | null;

  payload?: any;
  meta?: any;
  error_message?: string;

  created_at: string;
  updated_at: string;
};
