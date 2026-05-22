// PATH: src/app_teacher/domains/lectures/api.ts
// 강의/세션 API — 기존 lectures API 래핑
import api from "@/shared/api/axios";

export {
  downloadAttendanceExcel,
  fetchAttendanceMatrix,
  type AttendanceMatrixCell,
  type AttendanceMatrixResponse,
  type AttendanceMatrixSession,
  type AttendanceMatrixStudent,
} from "@/shared/api/contracts/attendance";

export type TeacherLecture = {
  id: number;
  title: string;
  name?: string | null;
  subject?: string | null;
  description?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  lecture_time?: string | null;
  lectureTime?: string | null;
  color?: string | null;
  chip_label?: string | null;
  chipLabel?: string | null;
  is_active?: boolean;
  isActive?: boolean;
};

export type TeacherLectureEnrollment = {
  id: number;
  student_id?: number | null;
  student_name?: string | null;
  student_phone?: string | null;
  studentPhone?: string | null;
  parent_phone?: string | null;
  parentPhone?: string | null;
  phone?: string | null;
  name?: string | null;
  status?: string | null;
  student?: {
    id?: number | null;
    name?: string | null;
    phone?: string | null;
    parent_phone?: string | null;
  } | null;
};

function extractList<T>(raw: unknown): T[] {
  if (Array.isArray(raw)) return raw as T[];
  if (!raw || typeof raw !== "object") return [];

  const { results } = raw as { results?: unknown };
  return Array.isArray(results) ? (results as T[]) : [];
}

/** 강의 목록 */
export async function fetchLectures(active?: boolean): Promise<TeacherLecture[]> {
  const res = await api.get("/lectures/lectures/", {
    params: { is_active: active, page_size: 100 },
  });
  return extractList<TeacherLecture>(res.data as unknown);
}

/** 강의 단건 */
export async function fetchLecture(lectureId: number) {
  const res = await api.get(`/lectures/lectures/${lectureId}/`);
  return res.data;
}

/** 강의의 세션 목록 */
export async function fetchLectureSessions(lectureId: number) {
  const res = await api.get("/lectures/sessions/", {
    params: { lecture: lectureId, page_size: 100, ordering: "-date" },
  });
  const raw = res.data;
  return Array.isArray(raw?.results) ? raw.results : Array.isArray(raw) ? raw : [];
}

/** 세션 단건 */
export async function fetchSession(sessionId: number) {
  const res = await api.get(`/lectures/sessions/${sessionId}/`);
  return res.data;
}

/** 강의 수강생 목록 (enrollments 기반) — backend 마운트: /api/v1/enrollments/ */
export async function fetchLectureEnrollments(lectureId: number): Promise<TeacherLectureEnrollment[]> {
  const res = await api.get("/enrollments/", {
    params: { lecture: lectureId, page_size: 200 },
  });
  return extractList<TeacherLectureEnrollment>(res.data);
}

/** 세션 수강생 출석 목록 */
export async function fetchSessionAttendance(sessionId: number) {
  const res = await api.get("/lectures/attendance/", {
    params: { session: sessionId, page_size: 200 },
  });
  const raw = res.data;
  return Array.isArray(raw?.results) ? raw.results : Array.isArray(raw) ? raw : [];
}

/* ─── Lecture CRUD ─── */
export async function createLecture(payload: {
  title: string;
  name: string;
  subject?: string;
  description?: string;
  start_date?: string | null;
  end_date?: string | null;
  lecture_time?: string | null;
  color?: string | null;
  is_active?: boolean;
}) {
  const res = await api.post("/lectures/lectures/", payload);
  return res.data;
}

export async function updateLecture(lectureId: number, payload: Record<string, unknown>) {
  const res = await api.patch(`/lectures/lectures/${lectureId}/`, payload);
  return res.data;
}

export async function deleteLecture(lectureId: number) {
  await api.delete(`/lectures/lectures/${lectureId}/`);
}

/* ─── Session CRUD ─── */
export async function createSession(lectureId: number, title: string, date?: string | null, order?: number | null) {
  const res = await api.post("/lectures/sessions/", { lecture: lectureId, title, date, order });
  return res.data;
}

export async function updateSession(sessionId: number, payload: { title?: string; date?: string; order?: number }) {
  const res = await api.patch(`/lectures/sessions/${sessionId}/`, payload);
  return res.data;
}

export async function deleteSession(sessionId: number) {
  await api.delete(`/lectures/sessions/${sessionId}/`);
}

/* ─── Enrollment management ─── */
export async function bulkCreateEnrollments(lectureId: number, studentIds: number[]) {
  const res = await api.post("/enrollments/bulk_create/", { lecture: lectureId, students: studentIds });
  return res.data;
}

export async function deleteEnrollment(enrollmentId: number) {
  await api.delete(`/enrollments/${enrollmentId}/`);
}
