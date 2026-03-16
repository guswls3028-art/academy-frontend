/**
 * 출결 현황 — 학생용 안내 페이지
 */
import { Link } from "react-router-dom";
import EmptyState from "@/student/shared/ui/layout/EmptyState";

export default function AttendancePage() {
  return (
    <div style={{ padding: "var(--stu-space-4) 0" }}>
      <h1 style={{ fontSize: 20, fontWeight: 800, marginBottom: "var(--stu-space-6)" }}>
        출결 현황
      </h1>
      <EmptyState
        title="출결 정보"
        description="출석 현황은 각 수업의 차시 상세에서 확인할 수 있어요."
      />
      <div style={{ textAlign: "center", marginTop: "var(--stu-space-4)" }}>
        <Link
          to="/student/sessions"
          style={{
            display: "inline-block",
            padding: "10px 20px",
            borderRadius: "var(--stu-radius, 8px)",
            background: "var(--stu-primary, #3b82f6)",
            color: "#fff",
            fontWeight: 600,
            fontSize: 14,
            textDecoration: "none",
          }}
        >
          수업 목록 보기
        </Link>
      </div>
    </div>
  );
}
