export type ExamType = "template" | "regular";

export type AnswerVisibility = "hidden" | "after_closed" | "always";
export type ExamGradingMode = "choice" | "written" | "mixed";
export type ManualGradingMethod = "correctness" | "score";
export type ExamSegmentationStatus =
  | "none"
  | "processing"
  | "review_required"
  | "ready"
  | "failed"
  | "conversion_required";

export type ExamTabKey =
  | "setup"
  | "assets"
  | "submissions"
  | "results";

/**
 * ✅ 서버 단일진실 기반 Exam
 * exams_exam 스키마와 1:1 정합
 */
export type Exam = {
  id: number;

  title: string;
  description: string;
  subject: string;

  exam_type: ExamType;

  is_active: boolean;

  allow_retake: boolean;
  max_attempts: number;

  pass_score: number;
  max_score: number;
  grading_mode: ExamGradingMode;
  manual_grading_method: ManualGradingMethod;
  choice_question_count: number;
  segmentation_status: ExamSegmentationStatus;
  source_filename: string;
  display_order: number;

  open_at: string | null;
  close_at: string | null;

  template_exam_id: number | null;
  structure_owner_id: number;
  can_edit_structure: boolean;

  answer_visibility: AnswerVisibility;
  student_results_published: boolean;

  created_at: string;
  updated_at: string;
};
