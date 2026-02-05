// PATH: src/student/domains/dashboard/pages/DashboardPage.tsx

import StudentPageShell from "@/student/shared/ui/pages/StudentPageShell";
import { useStudentDashboard } from "../hooks/useStudentDashboard";
import EmptyState from "@/student/shared/ui/layout/EmptyState";
import { Link } from "react-router-dom";

export default function DashboardPage() {
  const { data, isLoading, isError } = useStudentDashboard();

  if (isLoading) {
    return (
      <StudentPageShell title="홈">
        <div className="stu-muted">불러오는 중...</div>
      </StudentPageShell>
    );
  }

  if (isError || !data) {
    return (
      <StudentPageShell title="홈">
        <EmptyState
          title="홈 정보를 불러오지 못했습니다."
          description="잠시 후 다시 시도해주세요."
        />
      </StudentPageShell>
    );
  }

  const badges = data.badges || {};
  const hasClinic = !!badges.clinic_upcoming;
  const hasCounseling = !!badges.counseling_upcoming;

  return (
    <StudentPageShell title="홈">
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {/* ===============================
         * 학습 바로가기
         * =============================== */}
        <div className="stu-card">
          <div style={{ fontWeight: 900, marginBottom: 12 }}>학습</div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 12,
            }}
          >
            <HomeAction to="/student/assignments" label="과제 제출" />
            <HomeAction to="/student/materials" label="자료실" />
            <HomeAction to="/student/exams" label="시험" />
            <HomeAction to="/student/grades" label="성적" />
          </div>
        </div>

        {/* ===============================
         * 클리닉
         * =============================== */}
        <div className="stu-card">
          <div style={{ fontWeight: 900, marginBottom: 6 }}>클리닉</div>
          <div className="stu-muted" style={{ marginBottom: 12 }}>
            {hasClinic
              ? "예정된 클리닉이 있습니다."
              : "예정된 클리닉이 없습니다."}
          </div>

          <Link
            to="/student/clinic"
            className="stu-btn-primary"
          >
            클리닉 예약하기
          </Link>
        </div>

        {/* ===============================
         * 상담
         * =============================== */}
        <div className="stu-card">
          <div style={{ fontWeight: 900, marginBottom: 6 }}>상담</div>
          <div className="stu-muted" style={{ marginBottom: 12 }}>
            {hasCounseling
              ? "예정된 상담이 있습니다."
              : "예정된 상담이 없습니다."}
          </div>

          <Link
            to="/student/counseling"
            className="stu-btn-primary"
          >
            상담 예약하기
          </Link>
        </div>
      </div>
    </StudentPageShell>
  );
}

function HomeAction({
  to,
  label,
}: {
  to: string;
  label: string;
}) {
  return (
    <Link
      to={to}
      style={{
        textDecoration: "none",
        borderRadius: 14,
        padding: "18px 14px",
        border: "1px solid var(--stu-border)",
        background: "var(--stu-surface)",
        color: "var(--stu-text)",
        fontWeight: 900,
        textAlign: "center",
      }}
    >
      {label}
    </Link>
  );
}
