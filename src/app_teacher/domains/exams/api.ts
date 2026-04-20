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

/* ─── Exam CRUD ─── */
export async function createTemplateExam(payload: { title: string; subject?: string; description?: string }) {
  const res = await api.post("/exams/", { ...payload, exam_type: "TEMPLATE" });
  return res.data;
}

export async function createRegularExam(payload: { title: string; template_exam_id?: number; session_id?: number; description?: string }) {
  const res = await api.post("/exams/", { ...payload, exam_type: "REGULAR" });
  return res.data;
}

export async function updateExam(examId: number, payload: Record<string, unknown>) {
  const res = await api.patch(`/exams/${examId}/`, payload);
  return res.data;
}

export async function deleteExam(examId: number) {
  await api.delete(`/exams/${examId}/`);
}

/* ─── Templates ─── */
export async function fetchTemplates() {
  const res = await api.get("/exams/", { params: { exam_type: "TEMPLATE", page_size: 200 } });
  const raw = res.data;
  return Array.isArray(raw?.results) ? raw.results : Array.isArray(raw) ? raw : [];
}

/** 템플릿 + 적용 강의 사용 현황 */
export async function fetchTemplatesWithUsage() {
  const res = await api.get("/exams/templates/with-usage/", { params: { page_size: 200 } });
  const raw = res.data;
  return Array.isArray(raw?.results) ? raw.results : Array.isArray(raw) ? raw : [];
}

export async function fetchHomeworkTemplatesWithUsage() {
  const res = await api.get("/homeworks/templates/with-usage/", { params: { page_size: 200 } });
  const raw = res.data;
  return Array.isArray(raw?.results) ? raw.results : Array.isArray(raw) ? raw : [];
}

/* ─── Bundles ─── */
export interface ExamBundle {
  id: number;
  name: string;
  description?: string;
  items?: Array<{ id?: number; kind: "exam" | "homework"; template_id: number; title?: string; order?: number }>;
  item_count?: number;
}

export async function fetchBundles(): Promise<ExamBundle[]> {
  const res = await api.get("/exams/bundles/", { params: { page_size: 100 } });
  const raw = res.data;
  return Array.isArray(raw?.results) ? raw.results : Array.isArray(raw) ? raw : [];
}

export async function fetchBundle(id: number): Promise<ExamBundle> {
  const res = await api.get(`/exams/bundles/${id}/`);
  return res.data;
}

export async function createBundle(payload: { name: string; description?: string; items?: ExamBundle["items"] }): Promise<ExamBundle> {
  const res = await api.post("/exams/bundles/", payload);
  return res.data;
}

export async function updateBundle(id: number, payload: Partial<ExamBundle>): Promise<ExamBundle> {
  const res = await api.put(`/exams/bundles/${id}/`, payload);
  return res.data;
}

export async function deleteBundle(id: number): Promise<void> {
  await api.delete(`/exams/bundles/${id}/`);
}

/* ─── Score entry (결과 등록/수정) ─── */
export async function updateResult(resultId: number, payload: { score?: number; is_pass?: boolean }) {
  const res = await api.patch(`/results/${resultId}/`, payload);
  return res.data;
}

/* ─── Homework CRUD ─── */
export async function createHomework(payload: { title: string; session?: number; max_score?: number; description?: string }) {
  const res = await api.post("/homeworks/", payload);
  return res.data;
}

export async function deleteHomework(homeworkId: number) {
  await api.delete(`/homeworks/${homeworkId}/`);
}

/* ─── OMR ─── */
export type OMRDefaults = {
  exam_title: string;
  lecture_name: string;
  session_name: string;
  mc_count: number;
  essay_count: number;
  n_choices: number;
  logo_url: string | null;
};

export type OMRParams = {
  exam_title?: string;
  lecture_name?: string;
  session_name?: string;
  mc_count: number;
  essay_count: number;
  n_choices: number;
};

export async function fetchOMRDefaults(examId: number): Promise<OMRDefaults> {
  const { data } = await api.get<OMRDefaults>(`/exams/${examId}/omr/defaults/`);
  return data;
}

export async function downloadOMRPdf(examId: number, params: OMRParams, filename?: string): Promise<void> {
  const { data } = await api.post(`/exams/${examId}/omr/pdf/`, params, { responseType: "blob" });
  const { downloadBlob } = await import("@/shared/utils/safeDownload");
  downloadBlob(data as Blob, `${filename || params.exam_title || "OMR"}_OMR.pdf`);
}

/** OMR 스캔 업로드 — 학생 제출 생성 */
export async function submitOMR(examId: number, payload: {
  enrollment_id: number;
  sheet_id?: string;
  file_key?: string;
  file?: File;
}): Promise<any> {
  if (payload.file) {
    const form = new FormData();
    form.append("file", payload.file);
    form.append("enrollment_id", String(payload.enrollment_id));
    if (payload.sheet_id) form.append("sheet_id", payload.sheet_id);
    const res = await api.post(`/submissions/submissions/exams/${examId}/omr/`, form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return res.data;
  }
  const res = await api.post(`/submissions/submissions/exams/${examId}/omr/`, payload);
  return res.data;
}
