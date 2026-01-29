// src/student/domains/dashboard/api/dashboard.ts
/**
 * ✅ Student Dashboard API (LOCK v1)
 *
 * 주의:
 * - 백엔드 계약이 아직 프로젝트마다 다를 수 있으므로 "파싱 fallback"만 제공
 * - 프론트가 판단/계산하는 로직은 절대 넣지 않음
 *
 * 권장 엔드포인트(예시):
 * GET /api/v1/student/dashboard/
 *
 * 기대 응답(권장):
 * {
 *   notices: [{ id, title, created_at }],
 *   today_sessions: [{ id, title, date, status }],
 *   badges: { unread_qna: number }
 * }
 */

import api from "@/student/shared/api/studentApi";

export type DashboardNotice = {
  id: number;
  title: string;
  created_at?: string | null;
};

export type DashboardSession = {
  id: number;
  title: string;
  date?: string | null;
  // 상태는 백엔드 문자열 그대로 표시만
  status?: string | null;
};

export type StudentDashboardResponse = {
  notices: DashboardNotice[];
  today_sessions: DashboardSession[];
  badges?: Record<string, any>;
};

export async function fetchStudentDashboard(): Promise<StudentDashboardResponse> {
  const res = await api.get("/student/dashboard/");

  const data = res.data ?? {};
  return {
    notices: Array.isArray(data.notices) ? data.notices : [],
    today_sessions: Array.isArray(data.today_sessions) ? data.today_sessions : [],
    badges: typeof data.badges === "object" && data.badges ? data.badges : {},
  };
}
