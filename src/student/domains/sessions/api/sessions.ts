// PATH: src/student/domains/sessions/api/sessions.ts

import api from "@/student/shared/api/studentApi";

export type StudentSession = {
  id: number;
  title: string;
  date?: string | null;
  status?: string | null;
  exam_ids?: number[] | null;
};

export async function fetchMySessions(): Promise<StudentSession[]> {
  const res = await api.get("/student/sessions/me/");
  const data = res.data;
  if (Array.isArray(data)) return data as StudentSession[];
  if (Array.isArray(data?.items)) return data.items as StudentSession[];
  return [];
}

export async function fetchSessionDetail(sessionId: number): Promise<StudentSession> {
  const res = await api.get(`/student/sessions/${sessionId}/`);
  return res.data as StudentSession;
}
