/**
 * 제출 허브 — 성적표 제출 / 과제 제출(동영상·사진) 선택
 */
import { Link } from "react-router-dom";
import StudentPageShell from "@/student/shared/ui/pages/StudentPageShell";
import { IconGrade, IconBoard } from "@/student/shared/ui/icons/Icons";

export default function SubmitHubPage() {
  return (
    <StudentPageShell
      title="제출"
      description="성적표 또는 과제(동영상·사진)를 제출하면 선생님 인벤토리에 저장됩니다."
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--stu-space-3)" }}>
        <Link
          to="/student/submit/score"
          className="stu-panel stu-panel--pressable stu-panel--accent stu-panel--nav"
          style={{ display: "flex", alignItems: "center", gap: "var(--stu-space-3)", padding: "var(--stu-space-4)" }}
        >
          <div style={{ flexShrink: 0 }}>
            <IconGrade style={{ width: 28, height: 28, color: "var(--stu-primary)" }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 16 }}>성적표 제출</div>
            <div className="stu-muted" style={{ fontSize: 13, marginTop: 2 }}>이미지·PDF로 성적표를 제출합니다.</div>
          </div>
          <span style={{ color: "var(--stu-text-muted)" }}>→</span>
        </Link>

        <Link
          to="/student/submit/assignment"
          className="stu-panel stu-panel--pressable stu-panel--accent stu-panel--nav"
          style={{ display: "flex", alignItems: "center", gap: "var(--stu-space-3)", padding: "var(--stu-space-4)" }}
        >
          <div style={{ flexShrink: 0 }}>
            <IconBoard style={{ width: 28, height: 28, color: "var(--stu-primary)" }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 16 }}>과제 제출</div>
            <div className="stu-muted" style={{ fontSize: 13, marginTop: 2 }}>동영상·사진으로 과제를 제출합니다.</div>
          </div>
          <span style={{ color: "var(--stu-text-muted)" }}>→</span>
        </Link>

        <Link
          to="/student/exams"
          className="stu-btn stu-btn--secondary"
          style={{ alignSelf: "flex-start", marginTop: "var(--stu-space-2)" }}
        >
          시험 보기
        </Link>
      </div>
    </StudentPageShell>
  );
}
