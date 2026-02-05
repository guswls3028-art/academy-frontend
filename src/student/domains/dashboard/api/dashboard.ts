// PATH: src/student/domains/dashboard/api/dashboard.ts

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
  status?: string | null;
};

export type StudentDashboardResponse = {
  notices: DashboardNotice[];
  today_sessions: DashboardSession[];
  badges: Record<string, any>;
};

export async function fetchStudentDashboard(): Promise<StudentDashboardResponse> {
  const res = await api.get("/student/dashboard/");
  const data = res.data ?? {};

  return {
    notices: Array.isArray(data.notices) ? data.notices : [],
    today_sessions: Array.isArray(data.today_sessions)
      ? data.today_sessions
      : [],
    badges: typeof data.badges === "object" && data.badges ? data.badges : {},
  };
}
