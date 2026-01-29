/**
 * PATH: src/features/results/types/results.types.ts
 *
 * ✅ Results Domain Types (Backend Contract Aligned)
 *
 * 설계 계약(중요):
 * - 단일 진실: 학생 식별은 enrollment_id
 * - Admin Exam Results List 응답은 "대표 Attempt 기준 final_score"가 단일 진실
 *
 * 백엔드 스펙(고정):
 * - GET /results/admin/exams/{exam_id}/results/
 *   [
 *     {
 *       enrollment_id,
 *       student_name,
 *       final_score,
 *       passed,
 *       clinic_required,
 *       submission_status
 *     }
 *   ]
 *
 * ⚠️ 레거시 호환:
 * - 기존 프론트/백엔드 일부 환경에서 pagination({results:[]}) 또는
 *   submission_id/submitted_at 등이 추가로 올 수 있어 optional로 허용.
 */

// ---------- 1) Student exam result ----------
export type ResultItem = {
  question_id: number;
  answer: string;
  is_correct: boolean;
  score: number;
  max_score: number;
  source: string;
};

export type StudentExamResult = {
  target_type: "exam" | "homework";
  target_id: number;
  enrollment_id: number;

  attempt_id?: number | null;

  total_score: number;
  max_score: number;
  submitted_at: string | null;

  items: ResultItem[];

  allow_retake?: boolean;
  max_attempts?: number;
  can_retake?: boolean;

  clinic_required?: boolean;
};

// ---------- 2) Admin exam results list ----------
export type AdminExamResultRow = {
  // ✅ 단일 진실 키
  enrollment_id: number;
  student_name: string;

  /**
   * ✅ 대표 Attempt 기준 최종 점수
   * - 대표 attempt가 없으면 null/undefined일 수 있음(운영 위험 케이스)
   */
  final_score?: number | null;

  /**
   * ✅ backend 계산 결과
   */
  passed?: boolean | null;
  clinic_required?: boolean;

  /**
   * ✅ 제출/채점 파이프라인 상태
   * 예: PENDING, GRADING, DONE, FAILED 등
   */
  submission_status?: string | null;

  /**
   * ==========================
   * 레거시/확장 필드 (optional)
   * ==========================
   * - 일부 백엔드 구현에서 내려올 수 있음
   */
  submitted_at?: string | null;
  submission_id?: number | null;

  // ❌ 더 이상 exam_score/exam_max_score는 list contract에 없음
  // - 상세(detail)에서만 total_score/max_score 확인
};

// ---------- 3) Exam summary ----------
export type AdminExamSummary = {
  participant_count: number;
  avg_score: number;
  min_score: number;
  max_score: number;

  pass_count: number;
  fail_count: number;
  pass_rate: number;

  clinic_count: number;
};

// ---------- 4) Session score summary ----------
export type SessionScoreSummary = {
  participant_count: number;
  avg_score: number;
  min_score: number;
  max_score: number;
  pass_rate: number;
  clinic_rate: number;
  attempt_stats: {
    avg_attempts: number;
    retake_ratio: number;
  };
};

// ---------- 5) Question stats ----------
export type QuestionStat = {
  question_id: number;
  attempts: number;
  correct: number;
  accuracy: number;
  avg_score: number;
  max_score: number;
};

export type TopWrongQuestion = {
  question_id: number;
  wrong_count: number;
};

// ---------- 6) Wrong notes ----------
export type WrongNoteItem = {
  exam_id: number;
  attempt_id: number;
  attempt_created_at: string | null;

  question_id: number;
  question_number: number | null;
  answer_type: string;

  student_answer: string;
  correct_answer: string;

  is_correct: boolean;
  score: number;
  max_score: number;

  meta?: unknown;
  extra?: unknown;
};

export type WrongNoteListResponse = {
  count: number;
  next: number | null;
  prev: number | null;
  results: WrongNoteItem[];
};

// ---------- 7) PDF job ----------
export type WrongNotePdfCreateResponse = {
  job_id: number;
  status: string;
  status_url?: string;
};

export type WrongNotePdfStatusResponse = {
  job_id: number;
  status: "PENDING" | "RUNNING" | "DONE" | "FAILED" | string;
  file_path: string;
  file_url: string | null;
  error_message: string;
  created_at: string;
  updated_at: string;
};
