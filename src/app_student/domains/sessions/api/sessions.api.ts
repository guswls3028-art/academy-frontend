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

type StudentSessionListResponse = StudentSession[] | {
  items?: StudentSession[];
  has_any_sessions?: boolean;
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

function normalizeStudentSessionList(data: StudentSessionListResponse): StudentSession[] {
  const items = Array.isArray(data) ? data : data?.items;
  return Array.isArray(items) ? items.map(normalizeStudentSession) : [];
}

export async function fetchMySessions(): Promise<StudentSession[]> {
  const { data } = await api.get<StudentSessionListResponse>("/student/sessions/me/");
  return normalizeStudentSessionList(data);
}

export async function fetchHomeSessions(): Promise<StudentHomeSessions> {
  const { data } = await api.get<StudentSessionListResponse>("/student/sessions/me/", {
    params: { scope: "home" },
  });
  const items = normalizeStudentSessionList(data);
  const hasAnySessions = items.length > 0 || (!Array.isArray(data) && data?.has_any_sessions === true);
  return { items, hasAnySessions };
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
