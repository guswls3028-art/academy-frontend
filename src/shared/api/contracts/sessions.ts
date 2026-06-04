import api from "@/shared/api/axios";
import {
  sortSessionsByDateDesc,
  sortSessionsByDisplayOrder,
  type SessionType,
} from "@/shared/product/sessions/sessionOrdering";

export { sortSessionsByDateDesc, sortSessionsByDisplayOrder };
export type { SessionType };

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
  chip_label?: string | null;
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
  order: number;
  session_type?: SessionType | null;
  regular_order?: number | null;
  display_label?: string | null;
  title: string;
  date?: string | null;
  created_at: string;
  updated_at: string;
}

function unpackList<T>(data: unknown): T[] {
  if (data && typeof data === "object" && Array.isArray((data as { results?: unknown }).results)) {
    return (data as { results: T[] }).results;
  }
  return Array.isArray(data) ? data as T[] : [];
}

export async function fetchLectures(params?: {
  is_active?: boolean;
  subject?: string;
  search?: string;
}): Promise<Lecture[]> {
  const res = await api.get("/lectures/lectures/", { params });
  return unpackList<Lecture>(res.data);
}

export async function fetchSession(sessionId: number): Promise<Session> {
  const res = await api.get(`/lectures/sessions/${sessionId}/`);
  return res.data;
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
