import api from "@/shared/api/axios";

export type ManualAnswerPreview = {
  exam_id: number;
  enrollment_id: number;
  expected_version: string | null;
  objective_score: number;
  total_score: number;
  max_score: number;
  subjective_pending: boolean;
  applied: boolean;
  preview_token: string;
  questions: Array<{
    question_id: number;
    number: number;
    answer: string;
    is_correct: boolean;
    score: number;
    max_score: number;
  }>;
};

export type ManualAnswerDraft = {
  exam_id: number;
  enrollment_id: number;
  expected_version: string | null;
  answers: Record<string, string>;
};

export async function fetchManualExamAnswers(examId: number, enrollmentId: number): Promise<ManualAnswerDraft> {
  const response = await api.get<ManualAnswerDraft>(
    `/results/admin/exams/${examId}/enrollments/${enrollmentId}/manual-answers/`,
  );
  return response.data;
}

export async function submitManualExamAnswers(
  examId: number,
  enrollmentId: number,
  input: {
    answers: Record<string, string>;
    expected_version: string | null;
    note: string;
    apply: boolean;
    preview_token?: string;
  },
): Promise<ManualAnswerPreview> {
  const response = await api.post<ManualAnswerPreview>(
    `/results/admin/exams/${examId}/enrollments/${enrollmentId}/manual-answers/`,
    input,
  );
  return response.data;
}
