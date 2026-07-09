// PATH: src/app_teacher/domains/students/api.ts
// 학생 API — 기존 students API 래핑 (모바일 전용 정규화)
import api from "@/shared/api/axios";
import { countFromApiResponse, listFromApiResponse } from "@/shared/api/response";
import {
  applyDisplayNames,
  mapStudent,
  uploadStudentBulkFromExcel,
} from "@/shared/api/contracts/students";
import type { ClientStudent, ClientStudentTag } from "@/shared/api/contracts/students";

export type TeacherStudentsResponse = {
  data: ClientStudent[];
  count: number;
};

export type TeacherStudentExamResult = {
  id: number | string;
  exam_title?: string | null;
  title?: string | null;
  homework_title?: string | null;
  session_title?: string | null;
  lecture_title?: string | null;
  lecture_color?: string | null;
  lecture_chip_label?: string | null;
  total_score?: number | null;
  score?: number | null;
  max_score?: number | null;
  is_pass?: boolean | null;
  passed?: boolean | null;
  achievement?: string | null;
  retake_count?: number | null;
  submitted_at?: string | null;
  homework_id?: number | string | null;
  type?: string | null;
};

export type StudentAccountNotificationLog = {
  id: number;
  sent_at: string | null;
  success?: boolean;
  status: string;
  notification_type: string;
  recipient_summary: string;
  failure_reason: string;
  target_id: string;
  target_name: string;
};

export type SendPasswordResetParams = {
  target: "student" | "parent";
  student_name: string;
  student_phone?: string;
  student_ps_number?: string;
  parent_phone?: string;
  temp_password?: string;
};

/** 학생 목록 (페이지네이션) */
export async function fetchStudents(params?: {
  search?: string;
  page?: number;
  page_size?: number;
  grade?: number;
  gender?: string;
  status?: string;
  is_managed?: boolean;
}): Promise<TeacherStudentsResponse> {
  const { status, ...rest } = params ?? {};
  const normalizedParams = {
    page_size: 50,
    ...rest,
    ...(status === "active" ? { is_managed: true } : {}),
    ...(status === "inactive" ? { is_managed: false } : {}),
  };
  const res = await api.get("/students/", {
    params: normalizedParams,
  });
  const raw = res.data;
  const items = listFromApiResponse(raw);
  const count = countFromApiResponse(raw, items.length);
  return { data: applyDisplayNames(items.map(mapStudent)), count };
}

/** 학생 단건 */
export async function fetchStudent(studentId: number): Promise<ClientStudent> {
  const res = await api.get(`/students/${studentId}/`);
  return mapStudent(res.data);
}

/** 학생 시험 성적 */
export async function fetchStudentExamResults(studentId: number): Promise<TeacherStudentExamResult[]> {
  const res = await api.get("/results/admin/student-grades/", {
    params: { student_id: studentId },
  });
  const raw = res.data;
  return Array.isArray(raw?.exams) ? raw.exams : [];
}

/** 학생 계정 알림톡 최근 이력 */
export async function fetchStudentAccountNotifications(studentId: number): Promise<StudentAccountNotificationLog[]> {
  const res = await api.get(`/students/${studentId}/account-notifications/`, {
    params: { limit: 5 },
  });
  return Array.isArray(res.data?.results) ? res.data.results : [];
}

/** 학생 출석 이력 */
export async function fetchStudentAttendance(studentId: number) {
  const res = await api.get("/lectures/attendance/", {
    params: { student: studentId, page_size: 200, ordering: "-date" },
  });
  return listFromApiResponse(res.data);
}

/* ─── 학생 편집 ─── */
export async function updateStudent(studentId: number, payload: {
  name?: string;
  phone?: string;
  parent_phone?: string;
  school_type?: "ELEMENTARY" | "MIDDLE" | "HIGH" | null;
  school?: string;
  school_class?: string;
  grade?: string;
  memo?: string;
}) {
  const { school, school_class, school_type, ...rest } = payload;
  const normalized: Record<string, unknown> = { ...rest };
  const effectiveSchoolType = school_type ?? "HIGH";
  if (school !== undefined) {
    normalized.school_type = effectiveSchoolType;
    normalized.elementary_school = effectiveSchoolType === "ELEMENTARY" ? school || null : null;
    normalized.middle_school = effectiveSchoolType === "MIDDLE" ? school || null : null;
    normalized.high_school = effectiveSchoolType === "HIGH" ? school || null : null;
  }
  if (school_class !== undefined) {
    normalized.high_school_class = effectiveSchoolType === "HIGH" ? school_class || null : null;
  }
  const res = await api.patch(`/students/${studentId}/`, normalized);
  return res.data;
}

/* ─── 엑셀 내보내기 ─── */
export async function exportStudentsExcel() {
  const mod = await import("@/shared/product/students/studentExcel");
  const pageSize = 500;
  let page = 1;
  let allData: ClientStudent[] = [];
  let expectedCount: number | null = null;
  while (true) {
    const chunk = await fetchStudents({ page, page_size: pageSize });
    allData = [...allData, ...chunk.data];
    expectedCount = chunk.count;
    if (chunk.data.length < pageSize || allData.length >= chunk.count) break;
    page += 1;
  }
  await mod.downloadStudentsExcel(
    expectedCount != null ? allData.slice(0, expectedCount) : allData,
    `students-${new Date().toISOString().slice(0, 10)}.xlsx`,
  );
}

/* ─── 엑셀 벌크 업로드 ─── */
export async function uploadStudentBulkExcel(
  file: File,
  initialPassword: string,
  sendWelcomeMessage = true,
) {
  return uploadStudentBulkFromExcel(file, initialPassword, sendWelcomeMessage);
}

/* ─── 학생 삭제 (soft delete) ─── */
export async function deleteStudent(studentId: number) {
  await api.delete(`/students/${studentId}/`);
}

/* ─── 활성/비활성 토글 ─── */
export async function toggleStudentActive(studentId: number, nextActive: boolean) {
  const res = await api.patch(`/students/${studentId}/`, { is_managed: nextActive });
  return mapStudent(res.data);
}

/* ─── 태그 관리 ─── */
export async function fetchTags(): Promise<ClientStudentTag[]> {
  const res = await api.get("/students/tags/", { params: { page_size: 200 } });
  return listFromApiResponse<ClientStudentTag>(res.data);
}

export async function attachTag(studentId: number, tagId: number) {
  await api.post(`/students/${studentId}/add_tag/`, { tag_id: tagId });
}

export async function detachTag(studentId: number, tagId: number) {
  await api.post(`/students/${studentId}/remove_tag/`, { tag_id: tagId });
}

export async function createTag(name: string): Promise<ClientStudentTag> {
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

export async function sendPasswordReset(params: SendPasswordResetParams): Promise<{ message: string }> {
  const body: Record<string, string | boolean> = {
    target: params.target,
    student_name: params.student_name.trim(),
  };
  if (params.target === "student" && params.student_ps_number) {
    body.student_ps_number = params.student_ps_number.trim();
  }
  if (params.target === "student" && params.student_phone) {
    body.student_phone = normalizePhone(params.student_phone);
  }
  if (params.target === "parent" && params.parent_phone) {
    body.parent_phone = normalizePhone(params.parent_phone);
  }
  if (params.temp_password?.trim()) body.temp_password = params.temp_password.trim();
  const res = await api.post<{ message: string }>("/students/password_reset_send/", body);
  return res.data;
}
