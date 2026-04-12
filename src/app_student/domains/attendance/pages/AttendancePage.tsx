/**
 * 출결 현황 — 일정 페이지의 출결 뷰로 안내
 */
import { Link } from "react-router-dom";
import StudentPageShell from "@student/shared/ui/pages/StudentPageShell";
import { IconCalendar } from "@student/shared/ui/icons/Icons";

export default function AttendancePage() {
  return (
    <StudentPageShell title="출결 현황" description="수업별 출석 현황을 확인하세요.">
      <div style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "var(--stu-space-10, 48px) 0",
        textAlign: "center",
        gap: "var(--stu-space-5)",
      }}>
        <div style={{
          width: 72, height: 72, borderRadius: "50%",
          background: "linear-gradient(135deg, var(--stu-tint-primary), var(--stu-surface-soft))",
          border: "1px solid var(--stu-border-subtle)",
          display: "grid", placeItems: "center",
        }}>
          <IconCalendar style={{ width: 34, height: 34, color: "var(--stu-primary)" }} />
        </div>
        <div>
          <div style={{ fontSize: 17, fontWeight: 600, color: "var(--stu-text)", marginBottom: "var(--stu-space-2)" }}>
            각 수업에서 출석을 확인할 수 있어요
          </div>
          <div style={{ fontSize: 14, color: "var(--stu-text-muted)", lineHeight: 1.6, maxWidth: 300, margin: "0 auto" }}>
            일정 목록에서 수업을 선택하면 해당 차시의 출결 상태를 볼 수 있습니다.
          </div>
        </div>
        <Link
          to="/student/sessions"
          className="stu-btn stu-btn--primary"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "12px 24px",
            minHeight: 44,
            borderRadius: "var(--stu-radius-md)",
            background: "var(--stu-primary)",
            color: "var(--stu-primary-contrast)",
            fontWeight: 700,
            fontSize: 15,
            textDecoration: "none",
          }}
        >
          <IconCalendar style={{ width: 18, height: 18 }} />
          수업 일정 보기
        </Link>
      </div>
    </StudentPageShell>
  );
}
