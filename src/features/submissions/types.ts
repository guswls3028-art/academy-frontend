// PATH: src/features/submissions/types.ts

export type SubmissionStatus =
  | "submitted"
  | "dispatched"
  | "extracting"
  | "needs_identification" // ✅ 추가
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

export type SubmissionTargetType = "exam" | "homework";

/**
 * ✅ Backend Submission 모델과 1:1 대응
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
