// PATH: src/app_student/domains/sessions/api/sessions.ts

import api from "@student/shared/api/student.api";
import { richHtmlToPlainText } from "@/shared/utils/richHtml";
import { formatSessionLabel, type SessionOrderLike } from "@/shared/product/sessions/sessionOrdering";

export type StudentSession = SessionOrderLike & {
  id: number;
  title: string;
  date?: string | null;
  schedule_label?: string | null;
  schedule_configured?: boolean;
  end_time?: string | null;
  status?: string | null;
  exam_ids?: number[] | null;
  type?: "session" | "clinic";
  start_time?: string | null;
};

export type StudentHomeSessions = {
  items: StudentSession[];
  hasAnySessions: boolean;
};

function normalizeStudentSession(session: StudentSession): StudentSession {
  const title = richHtmlToPlainText(session.title);
  return {
    ...session,
    title: session.type === "clinic" ? title : formatSessionLabel({
      ...session,
      title,
      display_label: richHtmlToPlainText(session.display_label),
    }),
  };
}

async function fetchSessionList(scope?: "home"): Promise<StudentHomeSessions> {
  const { data } = await api.get<StudentSession[] | { items?: StudentSession[]; has_any_sessions?: boolean }>(
    "/student/sessions/me/",
    scope ? { params: { scope } } : undefined,
  );
  const items = Array.isArray(data) ? data : data?.items;
  const sessions = Array.isArray(items) ? items.map(normalizeStudentSession) : [];
  const hasAnySessions = sessions.length > 0 || (!Array.isArray(data) && data?.has_any_sessions === true);
  return { items: sessions, hasAnySessions };
}

export async function fetchMySessions(): Promise<StudentSession[]> {
  return (await fetchSessionList()).items;
}

export function fetchHomeSessions(): Promise<StudentHomeSessions> {
  return fetchSessionList("home");
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
