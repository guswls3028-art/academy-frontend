// PATH: src/app_teacher/domains/students/api.ts
// 학생 API — 기존 students API 래핑 (모바일 전용 정규화)
import api from "@/shared/api/axios";

/** 학생 목록 (페이지네이션) */
export async function fetchStudents(params?: {
  search?: string;
  page?: number;
  page_size?: number;
}) {
  const res = await api.get("/students/", {
    params: { page_size: 50, ...params },
  });
  const raw = res.data;
  const items = Array.isArray(raw?.results)
    ? raw.results
    : Array.isArray(raw)
      ? raw
      : [];
  const count = typeof raw?.count === "number" ? raw.count : items.length;
  return { data: items, count };
}

/** 학생 단건 */
export async function fetchStudent(studentId: number) {
  const res = await api.get(`/students/${studentId}/`);
  return res.data;
}

/** 학생 시험 성적 */
export async function fetchStudentExamResults(studentId: number) {
  const res = await api.get("/results/", {
    params: { student: studentId, page_size: 200, ordering: "-created_at" },
  });
  const raw = res.data;
  return Array.isArray(raw?.results) ? raw.results : Array.isArray(raw) ? raw : [];
}

/** 학생 출석 이력 */
export async function fetchStudentAttendance(studentId: number) {
  const res = await api.get("/lectures/attendances/", {
    params: { student: studentId, page_size: 200, ordering: "-date" },
  });
  const raw = res.data;
  return Array.isArray(raw?.results) ? raw.results : Array.isArray(raw) ? raw : [];
}

/* ─── 학생 편집 ─── */
export async function updateStudent(studentId: number, payload: {
  name?: string;
  phone?: string;
  parent_phone?: string;
  school?: string;
  grade?: string;
  memo?: string;
}) {
  const res = await api.patch(`/students/${studentId}/`, payload);
  return res.data;
}

/* ─── 엑셀 내보내기 ─── */
export async function exportStudentsExcel() {
  const res = await api.get("/students/export/", { responseType: "blob" });
  const url = window.URL.createObjectURL(res.data);
  const a = document.createElement("a");
  a.href = url;
  a.download = `students-${new Date().toISOString().slice(0, 10)}.xlsx`;
  a.click();
  window.URL.revokeObjectURL(url);
}

/* ─── 엑셀 벌크 업로드 ─── */
export async function uploadStudentBulkExcel(file: File, initialPassword: string) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("initial_password", initialPassword);
  const res = await api.post("/students/bulk-upload/", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data;
}

/* ─── 학생 삭제 (soft delete) ─── */
export async function deleteStudent(studentId: number) {
  await api.delete(`/students/${studentId}/`);
}

/* ─── 활성/비활성 토글 ─── */
export async function toggleStudentActive(studentId: number) {
  const res = await api.post(`/students/${studentId}/toggle-active/`);
  return res.data;
}

/* ─── 태그 관리 ─── */
export async function fetchTags() {
  const res = await api.get("/students/tags/", { params: { page_size: 200 } });
  const raw = res.data;
  return Array.isArray(raw?.results) ? raw.results : Array.isArray(raw) ? raw : [];
}

export async function attachTag(studentId: number, tagId: number) {
  await api.post(`/students/${studentId}/tags/`, { tag_id: tagId });
}

export async function detachTag(studentId: number, tagId: number) {
  await api.delete(`/students/${studentId}/tags/${tagId}/`);
}

export async function createTag(name: string) {
  const res = await api.post("/students/tags/", { name });
  return res.data;
}

/* ─── 메모 ─── */
export async function updateStudentMemo(studentId: number, memo: string) {
  const res = await api.patch(`/students/${studentId}/`, { memo });
  return res.data;
}
