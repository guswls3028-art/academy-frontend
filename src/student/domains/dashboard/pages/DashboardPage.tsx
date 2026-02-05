// src/student/domains/dashboard/pages/DashboardPage.tsx
/**
 * ✅ DashboardPage (LOCK v1)
 * - 학생앱의 행동 허브
 * - 이미지 UI 구조를 그대로 도메인화한 페이지
 *
 * 원칙:
 * - 오늘 할 일/정렬/판단 ❌
 * - 백엔드 응답 그대로 렌더링 ✅
 */

import StudentPageShell from "../../../shared/ui/pages/StudentPageShell";
import { useStudentDashboard } from "@/student/domains/dashboard/hooks/useStudentDashboard";
import NoticeBanner from "@/student/domains/dashboard/components/NoticeBanner";
import TodaySessionsCard from "@/student/domains/dashboard/components/TodaySessionsCard";
import QuickActionGrid from "@/student/domains/dashboard/components/QuickActionGrid";
import EmptyState from "../../../shared/ui/layout/EmptyState";

export default function DashboardPage() {
  const { data, isLoading, isError } = useStudentDashboard();

  if (isLoading) {
    return (
      <StudentPageShell title="홈" description="오늘 해야 할 일을 확인하세요.">
        <div style={{ color: "#666", fontSize: 14 }}>불러오는 중...</div>
      </StudentPageShell>
    );
  }

  if (isError || !data) {
    return (
      <StudentPageShell title="홈" description="오늘 해야 할 일을 확인하세요.">
        <EmptyState title="대시보드를 불러오지 못했습니다." description="백엔드 응답을 확인해주세요." />
      </StudentPageShell>
    );
  }

  return (
    <StudentPageShell title="홈" description="오늘 해야 할 일을 확인하세요.">
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <NoticeBanner notices={data.notices} />
        <TodaySessionsCard sessions={data.today_sessions} />
        <QuickActionGrid />
      </div>
    </StudentPageShell>
  );
}
