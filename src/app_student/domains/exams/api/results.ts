// PATH: src/app_student/domains/exams/api/results.ts

import api from "@student/shared/api/student.api";

export type AnswerVisibility = "hidden" | "after_closed" | "always";

export type ClinicRetakeInfo = {
  score: number | null;
  pass_score: number | null;
  attempt_id: number | null;
  resolved_at: string | null;
};

export type MyExamResult = {
  exam_id: number;
  attempt_id: number;
  total_score: number;
  max_score: number;
  is_pass: boolean | null;           // 1차 응시 기준 합격 여부
  final_pass?: boolean | null;        // 1차 합격 OR 클리닉 통과 → 최종 합격
  remediated?: boolean;               // 클리닉 재시험 통과로 해소됨
  clinic_retake?: ClinicRetakeInfo | null;  // 클리닉 재시험 상세
  clinic_required?: boolean;          // 현재 미해소 클리닉 대상 여부
  is_provisional?: boolean;           // ExamResult 미확정(DRAFT) 상태
  meta_status?: string | null;        // "NOT_SUBMITTED" = 미응시
  submitted_at: string | null;
  can_retake: boolean;
  answer_visibility?: AnswerVisibility;
  answers_visible?: boolean;
  // 석차 정보
  rank?: number | null;
  percentile?: number | null;
  cohort_size?: number | null;
  cohort_avg?: number | null;
};

export type MyExamResultItem = {
  question_id: number;
  question_number: number;
  student_answer: string | null;
  correct_answer: string | null;
  score: number;
  max_score: number;
  is_correct: boolean;
  meta?: Record<string, any>;
};

export async function fetchMyExamResult(examId: number): Promise<MyExamResult> {
  const res = await api.get(`/student/results/me/exams/${examId}/`);
  return res.data as MyExamResult;
}

export async function fetchMyExamResultItems(
  examId: number
): Promise<MyExamResultItem[]> {
  const res = await api.get<MyExamResultItem[] | { items?: MyExamResultItem[] }>(
    `/student/results/me/exams/${examId}/items/`,
  );
  const data = res.data;
  if (data && !Array.isArray(data) && Array.isArray(data.items)) return data.items;
  if (Array.isArray(data)) return data;
  return [];
}
