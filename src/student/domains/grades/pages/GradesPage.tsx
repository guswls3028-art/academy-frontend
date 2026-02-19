/**
 * 성적 — 시험·과제 결과 허브 (대형학원 SaaS)
 */
import { Link } from "react-router-dom";
import EmptyState from "@/student/shared/ui/layout/EmptyState";
import { IconGrade, IconExam, IconChevronRight } from "@/student/shared/ui/icons/Icons";

export default function GradesPage() {
  return (
    <div style={{ padding: "var(--stu-space-2) 0" }}>
      <Link
        to="/student/exams"
        className="stu-card stu-card--pressable"
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--stu-space-4)",
          marginBottom: "var(--stu-space-4)",
          textDecoration: "none",
          color: "inherit",
        }}
      >
        <div style={{ width: 44, height: 44, borderRadius: 12, background: "var(--stu-surface-soft)", display: "grid", placeItems: "center" }}>
          <IconExam style={{ width: 24, height: 24, color: "var(--stu-primary)" }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 15 }}>시험 결과</div>
          <div className="stu-muted" style={{ fontSize: 13, marginTop: 2 }}>응시한 시험의 채점 결과를 확인하세요</div>
        </div>
        <IconChevronRight style={{ width: 20, height: 20, color: "var(--stu-text-muted)" }} />
      </Link>

      <div className="stu-section stu-section--nested">
        <EmptyState
          title="성적 요약"
          description="시험 결과는 위 '시험 결과'에서 확인할 수 있습니다. 과제·출결 종합 성적은 추후 제공됩니다."
        />
      </div>
    </div>
  );
}
