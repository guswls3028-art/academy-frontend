// PATH: src/app_student/domains/sessions/api/sessions.ts

import api from "@student/shared/api/student.api";
import { richHtmlToPlainText } from "@/shared/utils/richHtml";

export type StudentSession = {
  id: number;
  title: string;
  date?: string | null;
  status?: string | null;
  exam_ids?: number[] | null;
  type?: "session" | "clinic";
  start_time?: string | null;
};

function normalizeStudentSession(session: StudentSession): StudentSession {
  return {
    ...session,
    title: richHtmlToPlainText(session.title),
  };
}

export async function fetchMySessions(): Promise<StudentSession[]> {
  const res = await api.get<StudentSession[] | { items?: StudentSession[] }>("/student/sessions/me/");
  const data = res.data;
  if (Array.isArray(data)) return data.map(normalizeStudentSession);
  if (data && Array.isArray(data.items)) return data.items.map(normalizeStudentSession);
  return [];
}

export async function fetchSessionDetail(sessionId: number): Promise<StudentSession> {
  const res = await api.get(`/student/sessions/${sessionId}/`);
  return normalizeStudentSession(res.data as StudentSession);
}

export async function clearMyPastSessions(): Promise<{ hidden_before: string }> {
  const res = await api.post<{ hidden_before: string }>("/student/sessions/clear-past/");
  return res.data;
}

export async function hideMySession(id: number): Promise<{ hidden_ids: number[] }> {
  const res = await api.post<{ hidden_ids: number[] }>("/student/sessions/hide/", { id });
  return res.data;
}

export async function unhideMySession(id: number): Promise<{ hidden_ids: number[] }> {
  const res = await api.post<{ hidden_ids: number[] }>("/student/sessions/unhide/", { id });
  return res.data;
}
