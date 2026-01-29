export type ExamType = "template" | "regular";

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

  open_at: string | null;
  close_at: string | null;

  template_exam_id: number | null;

  created_at: string;
  updated_at: string;
};
