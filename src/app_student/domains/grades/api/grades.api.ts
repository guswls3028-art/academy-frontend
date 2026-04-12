// PATH: src/app_student/domains/grades/api/grades.ts

import api from "@student/shared/api/student.api";

/** achievement: PASS=1차합격, REMEDIATED=보강후합격, FAIL=불합격, NOT_SUBMITTED=미응시 */
export type Achievement = "PASS" | "REMEDIATED" | "FAIL" | "NOT_SUBMITTED";

export type MyExamGradeSummary = {
  exam_id: number;
  enrollment_id: number;
  title: string;
  total_score: number | null;  // null = 미응시
  max_score: number;
  is_pass: boolean | null;  // null = 합격 기준 미설정 또는 미응시
  achievement?: Achievement | null;
  meta_status?: string | null;  // "NOT_SUBMITTED" = 미응시
  retake_count?: number;
  session_title: string | null;
  lecture_title: string | null;
  submitted_at: string | null;
  // 석차 정보
  rank?: number | null;
  percentile?: number | null;
  cohort_size?: number | null;
  cohort_avg?: number | null;
};

export type MyHomeworkGradeSummary = {
  homework_id: number;
  enrollment_id: number;
  title: string;
  score: number;
  max_score: number | null;
  passed: boolean | null;
  achievement?: Achievement;
  retake_count?: number;
  session_title: string | null;
  lecture_title: string | null;
};

export type MyGradesSummary = {
  exams: MyExamGradeSummary[];
  homeworks: MyHomeworkGradeSummary[];
};

export async function fetchMyGradesSummary(): Promise<MyGradesSummary> {
  const res = await api.get("/student/grades/");
  const data: any = res.data ?? {};
  return {
    exams: Array.isArray(data.exams) ? data.exams : [],
    homeworks: Array.isArray(data.homeworks) ? data.homeworks : [],
  };
}
