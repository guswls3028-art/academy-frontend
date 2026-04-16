// PATH: src/app_teacher/domains/results/statsApi.ts
// 성적 통계 API — 기존 admin 엔드포인트 재사용 (IsTeacherOrAdmin)
import api from "@/shared/api/axios";

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
export async function fetchExamResults(examId: number) {
  const res = await api.get(`/results/admin/exams/${examId}/results/`, { params: { page_size: 200 } });
  const raw = res.data;
  return Array.isArray(raw?.results) ? raw.results : Array.isArray(raw) ? raw : [];
}

/** 강좌별 과제 점수 목록 (1차 시도만) */
export async function fetchHomeworkScores(lectureId: number) {
  const res = await api.get("/homework/scores/", { params: { lecture: lectureId, page_size: 500 } });
  const raw = res.data;
  return (Array.isArray(raw?.results) ? raw.results : Array.isArray(raw) ? raw : []) as Array<{
    id: number;
    enrollment_id: number;
    homework: number;
    score: number | null;
    max_score: number | null;
    passed: boolean;
    meta: { status?: string } | null;
  }>;
}
