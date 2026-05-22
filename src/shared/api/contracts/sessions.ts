import api from "@/shared/api/axios";

export interface Session {
  id: number;
  lecture: number;
  section?: number | null;
  section_label?: string | null;
  section_type?: string | null;
  order: number;
  title: string;
  date?: string | null;
  created_at: string;
  updated_at: string;
}

export async function fetchSession(sessionId: number): Promise<Session> {
  const res = await api.get(`/lectures/sessions/${sessionId}/`);
  return res.data;
}
