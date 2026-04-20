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

/* ─── 비밀번호 초기화 (개별) ─── */
function normalizePhone(v: string | null | undefined): string {
  if (v == null) return "";
  const d = String(v).replace(/\D/g, "");
  return d.length === 11 && d.startsWith("010") ? d : d.length === 10 && d.startsWith("10") ? "0" + d : d;
}

/* ─── Bulk actions ─── */
export async function bulkDeleteStudents(studentIds: number[]): Promise<void> {
  await api.post("/students/bulk_delete/", { ids: studentIds });
}

export async function bulkRestoreStudents(studentIds: number[]): Promise<void> {
  await api.post("/students/bulk_restore/", { ids: studentIds });
}

/** 백엔드에 bulk_tags 엔드포인트가 없으므로 개별 attach 반복 호출 */
export async function bulkAttachTag(studentIds: number[], tagId: number): Promise<{ ok: number; fail: number }> {
  let ok = 0, fail = 0;
  for (const sid of studentIds) {
    try { await attachTag(sid, tagId); ok++; }
    catch { fail++; }
  }
  return { ok, fail };
}

export async function bulkDetachTag(studentIds: number[], tagId: number): Promise<{ ok: number; fail: number }> {
  let ok = 0, fail = 0;
  for (const sid of studentIds) {
    try { await detachTag(sid, tagId); ok++; }
    catch { fail++; }
  }
  return { ok, fail };
}

export async function sendPasswordReset(params: {
  target: "student" | "parent";
  student_name: string;
  student_ps_number?: string;
  parent_phone?: string;
  temp_password?: string;
  skip_notify?: boolean;
}): Promise<{ message: string }> {
  const body: Record<string, string | boolean> = {
    target: params.target,
    student_name: params.student_name.trim(),
  };
  if (params.target === "student" && params.student_ps_number) {
    body.student_ps_number = params.student_ps_number.trim();
  }
  if (params.target === "parent" && params.parent_phone) {
    body.parent_phone = normalizePhone(params.parent_phone);
  }
  if (params.temp_password?.trim()) body.temp_password = params.temp_password.trim();
  if (params.skip_notify) body.skip_notify = true;
  const res = await api.post<{ message: string }>("/students/password_reset_send/", body);
  return res.data;
}
