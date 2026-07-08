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
  total_questions?: number;
  correct_count?: number;
  wrong_count?: number;
  accuracy_rate?: number | null;
  wrong_question_numbers?: number[];
};

export type MyHomeworkGradeSummary = {
  homework_id: number;
  enrollment_id: number;
  title: string;
  score: number | null;
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
  /** 학원장이 커스텀한 합/불 라벨. 빈 문자열이면 GradeBadge 기본값 사용. */
  labels?: { pass?: string; fail?: string };
};

export type MyGradesAnalytics = {
  student?: { id: number; name: string };
  date_range?: { days: number; from: string | null; to: string | null };
  summary: {
    exam_count: number;
    scored_exam_count: number;
    avg_score_pct: number | null;
    median_score_pct: number | null;
    p25_score_pct?: number | null;
    p75_score_pct?: number | null;
    pass_rate_pct: number | null;
    not_submitted_count: number;
    risk_level: "insufficient" | "attention" | "watch" | "stable" | string;
    generated_at?: string;
  };
  trends: Array<{
    exam_id: number;
    title: string;
    lecture_title: string | null;
    submitted_at: string | null;
    score_pct: number | null;
    cohort_avg_pct: number | null;
    rank: number | null;
    percentile: number | null;
    cohort_size: number | null;
  }>;
  lecture_breakdown: Array<{
    lecture_title: string;
    exam_count: number;
    avg_score_pct: number | null;
  }>;
  weak_questions: Array<{
    question_number: number;
    wrong_count: number;
  }>;
  homework: {
    assigned_count: number;
    graded_count: number;
    avg_score_pct: number | null;
    pass_rate_pct: number | null;
  };
  highlights: {
    latest_exam: { exam_id: number; title: string; score_pct: number | null } | null;
    best_exam: { exam_id: number; title: string; score_pct: number | null } | null;
    weakest_exam: { exam_id: number; title: string; score_pct: number | null } | null;
  };
  insights: string[];
  data_quality?: {
    filtered_test_exam_count: number;
  };
};

export async function fetchMyGradesSummary(): Promise<MyGradesSummary> {
  const res = await api.get<Partial<MyGradesSummary>>("/student/grades/");
  const data = res.data ?? {};
  return {
    exams: Array.isArray(data.exams) ? data.exams : [],
    homeworks: Array.isArray(data.homeworks) ? data.homeworks : [],
    labels: data.labels ?? undefined,
  };
}

export async function fetchMyGradesAnalytics(): Promise<MyGradesAnalytics> {
  const res = await api.get<MyGradesAnalytics>("/student/grades/analytics/");
  const data = res.data;
  return {
    ...data,
    summary: data.summary ?? {
      exam_count: 0,
      scored_exam_count: 0,
      avg_score_pct: null,
      median_score_pct: null,
      pass_rate_pct: null,
      not_submitted_count: 0,
      risk_level: "insufficient",
    },
    trends: Array.isArray(data.trends) ? data.trends : [],
    lecture_breakdown: Array.isArray(data.lecture_breakdown) ? data.lecture_breakdown : [],
    weak_questions: Array.isArray(data.weak_questions) ? data.weak_questions : [],
    homework: data.homework ?? {
      assigned_count: 0,
      graded_count: 0,
      avg_score_pct: null,
      pass_rate_pct: null,
    },
    highlights: data.highlights ?? {
      latest_exam: null,
      best_exam: null,
      weakest_exam: null,
    },
    insights: Array.isArray(data.insights) ? data.insights : [],
  };
}
