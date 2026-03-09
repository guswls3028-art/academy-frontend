/**
 * 출결 현황 — 대형학원 SaaS 기준 placeholder
 */
import EmptyState from "@/student/shared/ui/layout/EmptyState";

export default function AttendancePage() {
  return (
    <div style={{ padding: "var(--stu-space-4) 0" }}>
      <h1 style={{ fontSize: 20, fontWeight: 800, marginBottom: "var(--stu-space-6)" }}>
        출결 현황
      </h1>
      <EmptyState
        title="출결 정보"
        description="수업별 출석 현황은 관리자가 확인 후 별도 안내드립니다."
      />
    </div>
  );
}
