// PATH: src/app_teacher/domains/exams/api.ts
// 시험/과제 API — 기존 admin API 재사용
import api from "@/shared/api/axios";

/** 선생님이 담당하는 시험 목록 (최근순) */
export async function fetchExams(params?: { session_id?: number; lecture_id?: number }) {
  const res = await api.get("/exams/", {
    params: { ...params, page_size: 100, ordering: "-created_at" },
  });
  const raw = res.data;
  return Array.isArray(raw?.results) ? raw.results : Array.isArray(raw) ? raw : [];
}

/** 시험 상세 */
export async function fetchExam(examId: number) {
  const res = await api.get(`/exams/${examId}/`);
  return res.data;
}

/** 시험 결과(제출) 목록 */
export async function fetchExamResults(examId: number) {
  const res = await api.get("/results/", { params: { exam: examId, page_size: 200 } });
  const raw = res.data;
  return Array.isArray(raw?.results) ? raw.results : Array.isArray(raw) ? raw : [];
}

/** 숙제 목록 (세션 기반) */
export async function fetchHomeworks(params?: { session_id?: number }) {
  const res = await api.get("/homeworks/", {
    params: { ...params, page_size: 100, ordering: "-created_at" },
  });
  const raw = res.data;
  return Array.isArray(raw?.results) ? raw.results : Array.isArray(raw) ? raw : [];
}

/** 숙제 상세 */
export async function fetchHomework(homeworkId: number) {
  const res = await api.get(`/homeworks/${homeworkId}/`);
  return res.data;
}

/** 숙제 제출 목록 */
export async function fetchHomeworkSubmissions(homeworkId: number) {
  const res = await api.get(`/submissions/submissions/homework/${homeworkId}/`);
  const raw = res.data;
  return Array.isArray(raw?.results) ? raw.results : Array.isArray(raw) ? raw : [];
}
