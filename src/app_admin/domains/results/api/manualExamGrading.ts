import api from "@/shared/api/axios";

export type ManualGradeState = "correct" | "incorrect" | "review";

export type ManualGradeQuestion = {
  question_id: number;
  number: number;
  kind: "choice" | "essay";
  max_score: number;
  editable: boolean;
  entry_method: "omr" | "correctness" | "score";
};

export type ManualGradeCell = {
  editable: boolean;
  entry_method: "omr" | "correctness" | "score";
  state: ManualGradeState | null;
  score: number | null;
  include_in_wrong_note: boolean;
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
  cells: Record<string, ManualGradeCell>;
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
