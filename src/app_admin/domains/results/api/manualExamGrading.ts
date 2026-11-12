import api from "@/shared/api/axios";

export type ManualGradeState = "correct" | "incorrect" | "review";

export type ManualGradeQuestion = {
  question_id: number;
  number: number;
  kind: "choice" | "essay";
  answer_type?: "choice" | "numeric_short_answer" | "written";
  max_score: number;
  editable: boolean;
  entry_method: "omr" | "correctness" | "score";
};

export type ManualGradeCell = {
  answer?: string;
  grading_status?: "pending" | "graded" | null;
  editable: boolean;
  entry_method: "omr" | "correctness" | "score";
  state: ManualGradeState | null;
  score: number | null;
  include_in_wrong_note: boolean;
};

/**
 * 혼합형 시험에서 객관식 OMR 결과가 아직 없는 행의 처리 방식.
 * - omr_pending: 서술형만 먼저 저장하고 답안지가 매칭되면 자동 합산
 * - omr_restore: 결시 해제 시 연결된 답안지의 객관식을 다시 반영
 * - omr_review_required / omr_processing: OMR 검토·처리 후 저장 가능
 */
export type ManualGradeObjectiveStatus =
  | "omr_pending"
  | "omr_restore"
  | "omr_review_required"
  | "omr_processing";

/**
 * Beta: 교사가 OMR 채점란에 칠한 서술형 점수. 채점표 제안일 뿐이며 저장해야 반영된다.
 * - ok: 배점 안의 점수
 * - out_of_range: 읽은 점수가 현재 배점을 넘음
 * - needs_check: 겹쳐 칠했거나 일의 자리가 없어 읽지 못함
 */
export type ManualGradeOmrEssayScore = {
  status: "ok" | "out_of_range" | "needs_check";
  score: number | null;
  submission_id: number;
};

export type ManualGradeRow = {
  enrollment_id: number;
  student_name: string;
  school: string;
  lectures: Array<{
    id?: number | null;
    lecture_name?: string | null;
    color?: string | null;
    chip_label?: string | null;
  }>;
  expected_version: string | null;
  is_not_submitted: boolean;
  exam_not_submitted_count: number;
  objective_status?: ManualGradeObjectiveStatus | null;
  cells: Record<string, ManualGradeCell>;
  omr_essay_scores?: Record<string, ManualGradeOmrEssayScore>;
};

export type ManualGradeSheet = {
  exam_id: number;
  exam_title: string;
  grading_mode: "choice" | "written" | "mixed";
  manual_grading_method: "correctness" | "score";
  has_manual_questions: boolean;
  exam_max_score: number;
  question_score_total: number;
  score_adjustment_total: number;
  questions: ManualGradeQuestion[];
  rows: ManualGradeRow[];
  omr_essay_score_marks?: {
    enabled: boolean;
    beta: boolean;
    proposal_count: number;
    needs_check_count: number;
  };
};

export type ManualGradeRequestRow = {
  enrollment_id: number;
  expected_version: string | null;
  attendance: "present" | "absent";
  cells: Record<
    string,
    {
      state?: ManualGradeState;
      score?: number;
      include_in_wrong_note?: boolean;
    }
  >;
};

export type ManualGradePreview = {
  ok: boolean;
  applied: boolean;
  exam_id: number;
  exam_title: string;
  grading_mode: "choice" | "written" | "mixed";
  manual_grading_method: "correctness" | "score";
  matched_count: number;
  question_count: number;
  overwrite_count: number;
  not_submitted_count: number;
  objective_pending_count?: number;
  objective_restore_count?: number;
  errors: Array<{
    row: number | null;
    field: string;
    message: string;
  }>;
  rows: Array<{
    enrollment_id: number;
    student_name: string;
    correct_count: number;
    wrong_count: number;
    wrong_questions: number[];
    review_count: number;
    review_questions: number[];
    total_score: number;
    max_score: number;
    will_overwrite: boolean;
    is_not_submitted: boolean;
    objective_status?: ManualGradeObjectiveStatus | null;
  }>;
};

export type ManualGradeQuestionScoreChanges = {
  question_scores: Record<string, number>;
  expected_question_scores: Record<string, number>;
};

export async function fetchManualGradeSheet(
  examId: number,
): Promise<ManualGradeSheet> {
  const response = await api.get<ManualGradeSheet>(
    `/results/admin/exams/${examId}/manual-grading/`,
  );
  return response.data;
}

export async function previewManualGrades(
  examId: number,
  rows: ManualGradeRequestRow[],
  questionScoreChanges?: ManualGradeQuestionScoreChanges,
): Promise<ManualGradePreview> {
  return submitManualGrades(examId, rows, false, questionScoreChanges);
}

export async function applyManualGrades(
  examId: number,
  rows: ManualGradeRequestRow[],
  questionScoreChanges?: ManualGradeQuestionScoreChanges,
): Promise<ManualGradePreview> {
  return submitManualGrades(examId, rows, true, questionScoreChanges);
}

async function submitManualGrades(
  examId: number,
  rows: ManualGradeRequestRow[],
  apply: boolean,
  questionScoreChanges?: ManualGradeQuestionScoreChanges,
): Promise<ManualGradePreview> {
  const response = await api.post<ManualGradePreview>(
    `/results/admin/exams/${examId}/manual-grading/`,
    { rows, apply, ...questionScoreChanges },
  );
  return response.data;
}
