// PATH: src/app_admin/domains/lectures/api/sessions.ts
import api from "@/shared/api/axios";
import type { components } from "@/shared/api/generated/schema";
import type { LectureScheduleSettings } from "../lectureScheduleSettings";
import type { SessionScheduleDate } from "@/shared/product/sessions/sessionScheduleDisplay";
import {
  sortSessionsByDateDesc,
  sortSessionsByDisplayOrder,
  type SessionType,
} from "@/shared/product/sessions/sessionOrdering";

export { sortSessionsByDateDesc, sortSessionsByDisplayOrder };
export type { SessionType };

// ----------------------------------------
// TYPES
// ----------------------------------------
export interface Lecture extends Partial<LectureScheduleSettings> {
  id: number;
  title: string;
  name: string;
  subject: string;
  description?: string;
  start_date?: string | null;
  end_date?: string | null;
  lecture_time?: string | null;
  color?: string | null;
  chip_label?: string | null;
  active_enrollment_count?: number;
  is_active: boolean;
  is_system?: boolean;
  tenant: number;
  created_at: string;
  updated_at: string;
}

export interface Session {
  id: number;
  lecture: number;
  section?: number | null;
  section_label?: string | null;
  section_type?: string | null;
  schedule_dates?: SessionScheduleDate[];
  order: number;
  session_type?: SessionType | null;
  regular_order?: number | null;
  display_label?: string | null;
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
  return unpackList<Lecture>(res.data);
}

// ----------------------------------------
// 강의 담당자 선택지 (오너 + 강사)
// ----------------------------------------
export type LectureInstructorOption = { name: string; type: "owner" | "teacher" };

export async function fetchLectureInstructorOptions(): Promise<LectureInstructorOption[]> {
  const res = await api.get("/lectures/lectures/instructor-options/");
  return Array.isArray(res.data) ? res.data : [];
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
  chip_label?: string | null;
  is_active?: boolean;
} & Partial<LectureScheduleSettings>): Promise<Lecture> {
  const endpoint = hasLectureScheduleSettings(payload) ? "/lectures/lectures/with-schedule-settings/" : "/lectures/lectures/";
  const res = await api.post<Lecture>(endpoint, payload);
  return res.data;
}

function hasLectureScheduleSettings(payload: Partial<LectureScheduleSettings>): boolean {
  return payload.schedule_mode !== undefined || payload.schedule_defaults !== undefined;
}

// ----------------------------------------
// LECTURE 수정
// ----------------------------------------
export async function updateLecture(
  lectureId: number,
  payload: Partial<Omit<Lecture, "id" | "tenant" | "created_at" | "updated_at">>
): Promise<Lecture> {
  const suffix = hasLectureScheduleSettings(payload) ? "schedule-settings/" : "";
  const res = await api.patch<Lecture>(`/lectures/lectures/${lectureId}/${suffix}`, payload);
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
function unpackList<T>(data: unknown): T[] {
  if (data && typeof data === "object" && Array.isArray((data as { results?: unknown }).results)) {
    return (data as { results: T[] }).results;
  }
  return Array.isArray(data) ? data as T[] : [];
}

export async function fetchAllSessions(): Promise<Session[]> {
  const res = await api.get("/lectures/sessions/");
  return unpackList<Session>(res.data);
}

export async function fetchSessions(lectureId: number): Promise<Session[]> {
  if (lectureId == null || !Number.isFinite(lectureId)) {
    return [];
  }
  const res = await api.get(`/lectures/sessions/?lecture=${lectureId}`);
  return unpackList<Session>(res.data);
}

// ----------------------------------------
// SESSION 생성
// ----------------------------------------
export interface CreateSessionOptions {
  sessionType?: SessionType;
  regularOrder?: number | null;
  insertAfterOrder?: number | null;
  initialSchedule?: { requestId: string; days: InitialSessionDay[] };
}

export type InitialSessionDay = components["schemas"]["SessionCreateScheduleInputRequest"];

export async function createSession(
  lectureId: number,
  title: string,
  date?: string | null,
  order?: number | null,
  sectionId?: number | null,
  options: CreateSessionOptions = {},
): Promise<Session> {
  const payload: Record<string, unknown> = { lecture: lectureId, title };
  if (date !== undefined) payload.date = date;
  if (order != null) payload.order = order;
  if (sectionId != null) payload.section = sectionId;
  if (options.sessionType) payload.session_type = options.sessionType;
  if (options.regularOrder != null) payload.regular_order = options.regularOrder;
  if (options.insertAfterOrder != null) payload.insert_after_order = options.insertAfterOrder;
  if (options.initialSchedule) {
    payload.create_request_id = options.initialSchedule.requestId;
    payload.initial_schedules = options.initialSchedule.days;
  }

  const endpoint = options.initialSchedule ? "/lectures/sessions/with-schedules/" : "/lectures/sessions/";
  const res = await api.post<Session>(endpoint, payload);
  return res.data;
}

// ----------------------------------------
// SESSION 수정
// ----------------------------------------
export async function updateSession(
  sessionId: number,
  payload: Partial<Pick<Session, "title" | "date" | "order" | "section" | "session_type" | "regular_order">>
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
