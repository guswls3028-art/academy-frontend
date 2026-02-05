// PATH: src/student/domains/dashboard/api/dashboard.ts

import api from "@/student/shared/api/studentApi";

/**
 * ✅ Student Dashboard API (HOME 전용)
 *
 * 원칙:
 * - 홈에서는 "행동 유도 정보"만 사용
 * - 공지 / 일정 상세는 각 도메인에서만 노출
 */

export type StudentDashboardBadges = {
  clinic_upcoming?: boolean;
  counseling_upcoming?: boolean;
  [key: string]: any;
};

export type StudentDashboardResponse = {
  badges: StudentDashboardBadges;
};

export async function fetchStudentDashboard(): Promise<StudentDashboardResponse> {
  const res = await api.get("/student/dashboard/");
  const data = res.data ?? {};

  return {
    badges:
      typeof data.badges === "object" && data.badges
        ? data.badges
        : {},
  };
}
