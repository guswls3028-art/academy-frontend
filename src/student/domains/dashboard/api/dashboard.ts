// PATH: src/student/domains/dashboard/api/dashboard.ts

import api from "@/student/shared/api/studentApi";

export async function fetchStudentDashboard() {
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
