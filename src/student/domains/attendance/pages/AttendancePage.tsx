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
        description="수업별 출석 현황은 관리자 페이지에서 확인한 뒤 안내됩니다. API 연동 시 여기에 표시됩니다."
      />
    </div>
  );
}
