// PATH: src/student/domains/dashboard/api/dashboard.ts

import api from "@/student/shared/api/studentApi";

/**
 * ✅ Student Dashboard API (HOME 전용)
 *
 * - notices: 최신 공지 최대 5건 (Community block_type=notice)
 * - today_sessions: 오늘 수업 일정 (SessionEnrollment 기준)
 * - 공지/일정 상세는 각 도메인(/student/notices, /student/sessions)에서 노출
 */

export type DashboardNotice = {
  id: number;
  title: string;
  created_at: string | null;
};

export type DashboardSession = {
  id: number;
  title: string;
  date: string | null;
  status: string | null;
};

export type StudentDashboardBadges = {
  clinic_upcoming?: boolean;
  counseling_upcoming?: boolean;
  [key: string]: unknown;
};

export type StudentDashboardResponse = {
  notices: DashboardNotice[];
  today_sessions: DashboardSession[];
  badges: StudentDashboardBadges;
  tenant_info?: {
    name: string;
    phone: string;
    headquarters_phone: string;
    academies?: { name: string; phone: string }[];
  } | null;
};

export async function fetchStudentDashboard(): Promise<StudentDashboardResponse> {
  const res = await api.get("/student/dashboard/");
  const data = res.data ?? {};

  const notices = Array.isArray(data.notices)
    ? (data.notices as DashboardNotice[]).map((n) => ({
        id: Number(n.id),
        title: String(n.title ?? ""),
        created_at: n.created_at != null ? String(n.created_at) : null,
      }))
    : [];
  const today_sessions = Array.isArray(data.today_sessions)
    ? (data.today_sessions as DashboardSession[]).map((s) => ({
        id: Number(s.id),
        title: String(s.title ?? ""),
        date: s.date != null ? String(s.date) : null,
        status: s.status != null ? String(s.status) : null,
      }))
    : [];

  return {
    notices,
    today_sessions,
    badges:
      typeof data.badges === "object" && data.badges != null
        ? data.badges as StudentDashboardBadges
        : {},
    tenant_info:
      data.tenant_info && typeof data.tenant_info === "object"
        ? {
            name: String(data.tenant_info.name ?? ""),
            phone: String(data.tenant_info.phone ?? ""),
            headquarters_phone: String(data.tenant_info.headquarters_phone ?? ""),
            academies: Array.isArray(data.tenant_info.academies)
              ? (data.tenant_info.academies as { name?: string; phone?: string }[]).map((a) => ({
                  name: String(a.name ?? ""),
                  phone: String(a.phone ?? ""),
                }))
              : undefined,
          }
        : null,
  };
}
