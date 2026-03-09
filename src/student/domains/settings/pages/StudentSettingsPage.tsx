/**
 * 설정 — 내 정보 링크, 선생앱 설정과 동일한 진입 구조
 */
import { Link } from "react-router-dom";
import StudentPageShell from "@/student/shared/ui/pages/StudentPageShell";
import { IconUser } from "@/student/shared/ui/icons/Icons";

const linkStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "var(--stu-space-4)",
  padding: "var(--stu-space-6) var(--stu-space-4)",
  borderRadius: "var(--stu-radius-md)",
  background: "var(--stu-surface)",
  border: "1px solid var(--stu-border)",
  color: "var(--stu-text)",
  textDecoration: "none",
  fontWeight: 700,
  fontSize: 15,
  width: "100%",
  textAlign: "left",
};

export default function StudentSettingsPage() {
  return (
    <StudentPageShell title="설정" description="계정 및 앱 설정">
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--stu-space-4)" }}>
        <Link to="/student/profile" style={linkStyle}>
          <IconUser style={{ width: 22, height: 22, flexShrink: 0, color: "var(--stu-primary)" }} />
          내 정보
        </Link>
      </div>
    </StudentPageShell>
  );
}
