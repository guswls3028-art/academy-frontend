// PATH: src/app_teacher/domains/results/statsApi.ts
// 성적 통계 API — 기존 admin 엔드포인트 재사용 (IsTeacherOrAdmin)
import api from "@/shared/api/axios";
import { listFromApiResponse } from "@/shared/api/response";
import type { TeacherExamResultRow } from "@teacher/domains/scores/api";

export type EnterpriseAnalytics = {
  tenant: { id: number; name: string; code: string };
  date_range: { days: number; from: string | null; to: string | null };
  summary: {
    exam_result_count: number;
    scored_count: number;
    avg_score_pct: number | null;
    median_score_pct: number | null;
    p10_score_pct?: number | null;
    p25_score_pct?: number | null;
    p75_score_pct?: number | null;
    p90_score_pct?: number | null;
    std_score_pct?: number | null;
    pass_rate_pct: number | null;
    absent_count: number;
    generated_at?: string;
  };
  usage: {
    manual_score_events: number;
    manual_active_days: number;
    auto_grade_submissions: number;
    auto_grade_done: number;
    auto_grade_failed: number;
    auto_grade_review: number;
    auto_completion_rate_pct: number | null;
    latest_activity_at: string | null;
    activity_level: "none" | "light" | "regular" | "high" | string;
    source_breakdown: Record<string, number>;
  };
  trends: Array<{
    period: string;
    scored_count: number;
    avg_score_pct: number | null;
    median_score_pct: number | null;
    pass_rate_pct: number | null;
    manual_score_events: number;
    auto_grade_submissions: number;
    auto_grade_done: number;
    auto_completion_rate_pct: number | null;
  }>;
  top_exams: Array<{
    exam_id: number;
    title: string;
    result_count: number;
    scored_count: number;
    absent_count: number;
    avg_score_pct: number | null;
    median_score_pct: number | null;
    p10_score_pct: number | null;
    p90_score_pct: number | null;
    std_score_pct: number | null;
    pass_rate_pct: number | null;
  }>;
  weak_questions: Array<{
    exam_id: number;
    question_number: number;
    attempts: number;
    accuracy_pct: number | null;
    wrong_count: number;
    avg_score_pct: number | null;
  }>;
  data_quality: {
    tenant_exam_count: number;
    clean_exam_count: number;
    filtered_test_exam_count: number;
    total_exam_results: number;
    clean_exam_results: number;
    filtered_test_exam_results: number;
    no_enrollment_exam_results: number;
    foreign_enrollment_exam_results: number;
  };
};

/** 시험별 요약 (평균/최고/최저/합격률) */
export async function fetchExamSummary(examId: number) {
  const res = await api.get(`/results/admin/exams/${examId}/summary/`);
  return res.data as {
    participant_count: number;
    avg_score: number;
    min_score: number;
    max_score: number;
    pass_count: number;
    fail_count: number;
    pass_rate: number;
    clinic_count: number;
  };
}

/** 세션 내 시험 통계 일괄 */
export async function fetchSessionExamsSummary(sessionId: number) {
  const res = await api.get(`/results/admin/sessions/${sessionId}/exams/summary/`);
  return res.data as {
    session_id: number;
    participant_count: number;
    pass_rate: number;
    clinic_rate: number;
    strategy: string;
    pass_source: string;
    exams: Array<{
      exam_id: number;
      title: string;
      pass_score: number;
      participant_count: number;
      avg_score: number;
      min_score: number;
      max_score: number;
      highest_score: number;
      pass_count: number;
      fail_count: number;
      pass_rate: number;
    }>;
  };
}

/** 문항별 정답률 */
export async function fetchQuestionStats(examId: number) {
  const res = await api.get(`/results/admin/exams/${examId}/questions/`);
  return res.data as Array<{
    question_id: number;
    attempts: number;
    correct: number;
    accuracy: number;
    avg_score: number;
    max_score: number;
  }>;
}

/** 오답 많은 문항 top N */
export async function fetchTopWrongQuestions(examId: number, n = 5) {
  const res = await api.get(`/results/admin/exams/${examId}/questions/top-wrong/`, { params: { n } });
  return res.data as Array<{
    question_id: number;
    wrong_count: number;
  }>;
}

/** 시험 결과 목록 (석차 포함) */
export async function fetchExamResults(examId: number): Promise<TeacherExamResultRow[]> {
  const res = await api.get(`/results/admin/exams/${examId}/results/`, { params: { page_size: 200 } });
  return listFromApiResponse<TeacherExamResultRow>(res.data);
}

/** 강좌별 과제 점수 목록 (1차 시도만) */
export async function fetchHomeworkScores(lectureId: number) {
  const res = await api.get("/homework/scores/", { params: { lecture: lectureId, page_size: 500 } });
  return listFromApiResponse<{
    id: number;
    enrollment_id: number;
    homework: number;
    score: number | null;
    max_score: number | null;
    passed: boolean;
    meta: { status?: string } | null;
  }>(res.data);
}

export async function fetchEnterpriseAnalytics(): Promise<EnterpriseAnalytics> {
  const res = await api.get<EnterpriseAnalytics>("/results/admin/analytics/");
  return res.data;
}
