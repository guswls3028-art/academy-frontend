export type ExamType = "template" | "regular";

/** 과제와 동일. 사용자에는 설정 중/진행 중/마감으로만 노출 */
export type ExamStatus = "DRAFT" | "OPEN" | "CLOSED";

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
  /** 과제와 동일: DRAFT=설정 중, OPEN=진행 중, CLOSED=마감 */
  status: ExamStatus;

  allow_retake: boolean;
  max_attempts: number;

  pass_score: number;
  max_score: number;
  display_order: number;

  open_at: string | null;
  close_at: string | null;

  template_exam_id: number | null;

  created_at: string;
  updated_at: string;
};
