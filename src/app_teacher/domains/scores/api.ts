// PATH: src/app_teacher/domains/scores/api.ts
// 성적 API — admin endpoint(권한: IsTeacherOrAdmin)를 재사용해 enrollment 기반 schema 통일
import api from "@/shared/api/axios";

/** 세션에 연결된 시험 목록 (backend 필터: session_id) */
export async function fetchSessionExams(sessionId: number) {
  const res = await api.get("/exams/", { params: { session_id: sessionId, page_size: 50 } });
  const raw = res.data;
  return Array.isArray(raw?.results) ? raw.results : Array.isArray(raw) ? raw : [];
}

/**
 * 시험별 결과(성적) — admin endpoint 사용.
 * 응답 row schema: enrollment_id / student_name / exam_score / exam_max_score / final_score /
 *                 passed / achievement / final_pass / rank / percentile / cohort_avg ...
 */
export async function fetchExamResults(examId: number) {
  const res = await api.get(`/results/admin/exams/${examId}/results/`, { params: { page_size: 200 } });
  const raw = res.data;
  return Array.isArray(raw?.results) ? raw.results : Array.isArray(raw) ? raw : [];
}

/**
 * 결과 단건 수정 — 합산 점수 수동 입력 quick-patch.
 * Result row가 없으면 백엔드가 자동 생성.
 */
export async function updateResult(
  examId: number,
  enrollmentId: number,
  payload: { score: number | null; maxScore?: number | null },
) {
  const body: Record<string, unknown> = {
    score: payload.score,
    max_score: payload.maxScore ?? null,
  };
  const res = await api.patch(
    `/results/admin/exams/${examId}/enrollments/${enrollmentId}/score/`,
    body,
  );
  return res.data;
}
