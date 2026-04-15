// PATH: src/app_teacher/domains/scores/api.ts
// 성적 API — 기존 exams/results API 재사용
import api from "@/shared/api/axios";

/** 세션에 연결된 시험 목록 */
export async function fetchSessionExams(sessionId: number) {
  const res = await api.get("/exams/", { params: { session: sessionId, page_size: 50 } });
  const raw = res.data;
  return Array.isArray(raw?.results) ? raw.results : Array.isArray(raw) ? raw : [];
}

/** 시험별 결과(성적) 목록 */
export async function fetchExamResults(examId: number) {
  const res = await api.get("/results/", { params: { exam: examId, page_size: 200 } });
  const raw = res.data;
  return Array.isArray(raw?.results) ? raw.results : Array.isArray(raw) ? raw : [];
}

/** 결과 단건 수정 */
export async function updateResult(resultId: number, payload: { score?: number }) {
  const res = await api.patch(`/results/${resultId}/`, payload);
  return res.data;
}
