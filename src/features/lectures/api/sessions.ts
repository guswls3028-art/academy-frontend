// PATH: src/features/lectures/api/sessions.ts
import api from "@/shared/api/axios";

// ----------------------------------------
// TYPES
// ----------------------------------------
export interface Lecture {
  id: number;
  title: string;
  name: string;
  subject: string;
  description?: string;
  start_date?: string | null;
  end_date?: string | null;
  lecture_time?: string | null;
  color?: string | null;
  is_active: boolean;
  tenant: number;
  created_at: string;
  updated_at: string;
}

export interface Session {
  id: number;
  lecture: number;
  order: number;
  title: string;
  date?: string | null;
  created_at: string;
  updated_at: string;
}

// ----------------------------------------
// LECTURE 목록 가져오기
// ----------------------------------------
export async function fetchLectures(params?: {
  is_active?: boolean;
  subject?: string;
  search?: string;
}): Promise<Lecture[]> {
  const res = await api.get("/lectures/lectures/", { params });
  const data = res.data;
  return Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : [];
}

// ----------------------------------------
// LECTURE 상세 가져오기
// ----------------------------------------
export async function fetchLecture(lectureId: number): Promise<Lecture> {
  const res = await api.get(`/lectures/lectures/${lectureId}/`);
  return res.data;
}

// ----------------------------------------
// LECTURE 생성
// ----------------------------------------
export async function createLecture(payload: {
  title: string;
  name: string;
  subject: string;
  description?: string;
  start_date?: string | null;
  end_date?: string | null;
  lecture_time?: string | null;
  color?: string | null;
  is_active?: boolean;
}): Promise<Lecture> {
  const res = await api.post("/lectures/lectures/", payload);
  return res.data;
}

// ----------------------------------------
// LECTURE 수정
// ----------------------------------------
export async function updateLecture(
  lectureId: number,
  payload: Partial<Omit<Lecture, "id" | "tenant" | "created_at" | "updated_at">>
): Promise<Lecture> {
  const res = await api.patch(`/lectures/lectures/${lectureId}/`, payload);
  return res.data;
}

// ----------------------------------------
// LECTURE 삭제
// ----------------------------------------
export async function deleteLecture(lectureId: number): Promise<void> {
  await api.delete(`/lectures/lectures/${lectureId}/`);
}

// ----------------------------------------
// SESSION 상세 가져오기
// ----------------------------------------
export async function fetchSession(sessionId: number): Promise<Session> {
  const res = await api.get(`/lectures/sessions/${sessionId}/`);
  return res.data;
}

// ----------------------------------------
// SESSION 목록 가져오기 (lecture 기준)
// ----------------------------------------
export async function fetchSessions(lectureId: number): Promise<Session[]> {
  const res = await api.get(`/lectures/sessions/?lecture=${lectureId}`);
  const data = res.data;
  return Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : [];
}

// ----------------------------------------
// SESSION 생성
// ----------------------------------------
export async function createSession(
  lectureId: number,
  title: string,
  date?: string | null,
  order?: number | null
): Promise<Session> {
  const payload: {
    lecture: number;
    title: string;
    date?: string | null;
    order?: number | null;
  } = {
    lecture: lectureId,
    title,
  };
  
  if (date !== undefined) payload.date = date;
  if (order !== undefined) payload.order = order;

  const res = await api.post(`/lectures/sessions/`, payload);
  return res.data;
}

// ----------------------------------------
// SESSION 수정
// ----------------------------------------
export async function updateSession(
  sessionId: number,
  payload: Partial<Pick<Session, "title" | "date" | "order">>
): Promise<Session> {
  const res = await api.patch(`/lectures/sessions/${sessionId}/`, payload);
  return res.data;
}

// ----------------------------------------
// SESSION 삭제
// ----------------------------------------
export async function deleteSession(sessionId: number): Promise<void> {
  await api.delete(`/lectures/sessions/${sessionId}/`);
}

/**
 * ⚠️ ATTENDANCE는 여기서 조회하지 않는다.
 * - 경로 혼재(attendance vs attendances)로 404 폭탄 방지
 * - 출결 조회/수정/일괄등록은 반드시 `api/attendance.ts`만 사용
 */
// export async function fetchAttendance(sessionId: number) { ... }  // ❌ 제거
