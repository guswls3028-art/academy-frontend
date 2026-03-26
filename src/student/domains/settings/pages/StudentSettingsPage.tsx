/**
 * 설정 — 내 정보 링크 + 화면 모드(다크/라이트) 전환
 */
import { Link } from "react-router-dom";
import StudentPageShell from "@/student/shared/ui/pages/StudentPageShell";
import { IconUser } from "@/student/shared/ui/icons/Icons";
import { useStudentTheme } from "@/student/shared/context/StudentThemeContext";

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
  const { mode, setMode } = useStudentTheme();

  return (
    <StudentPageShell title="설정" description="계정 및 앱 설정">
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--stu-space-6)" }}>
        {/* 내 정보 */}
        <Link to="/student/profile" style={linkStyle}>
          <IconUser style={{ width: 22, height: 22, flexShrink: 0, color: "var(--stu-primary)" }} />
          내 정보
        </Link>

        {/* 화면 모드 */}
        <div
          style={{
            padding: "var(--stu-space-6) var(--stu-space-4)",
            borderRadius: "var(--stu-radius-md)",
            background: "var(--stu-surface)",
            border: "1px solid var(--stu-border)",
          }}
        >
          <div style={{ fontSize: 15, fontWeight: 700, color: "var(--stu-text)", marginBottom: 12 }}>
            화면 모드
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              onClick={() => setMode("light")}
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 8,
                padding: "12px 8px",
                borderRadius: "var(--stu-radius-md)",
                border: mode === "light" ? "2px solid var(--stu-primary)" : "1px solid var(--stu-border)",
                background: mode === "light" ? "var(--stu-tint-primary)" : "var(--stu-surface-soft)",
                cursor: "pointer",
                color: "var(--stu-text)",
                transition: "all 150ms ease",
              }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: mode === "light" ? "var(--stu-primary)" : "var(--stu-text-muted)" }}>
                <circle cx="12" cy="12" r="5" />
                <line x1="12" y1="1" x2="12" y2="3" />
                <line x1="12" y1="21" x2="12" y2="23" />
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                <line x1="1" y1="12" x2="3" y2="12" />
                <line x1="21" y1="12" x2="23" y2="12" />
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
              </svg>
              <span style={{ fontSize: 13, fontWeight: mode === "light" ? 700 : 500 }}>라이트</span>
            </button>
            <button
              type="button"
              onClick={() => setMode("dark")}
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 8,
                padding: "12px 8px",
                borderRadius: "var(--stu-radius-md)",
                border: mode === "dark" ? "2px solid var(--stu-primary)" : "1px solid var(--stu-border)",
                background: mode === "dark" ? "var(--stu-tint-primary)" : "var(--stu-surface-soft)",
                cursor: "pointer",
                color: "var(--stu-text)",
                transition: "all 150ms ease",
              }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: mode === "dark" ? "var(--stu-primary)" : "var(--stu-text-muted)" }}>
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
              <span style={{ fontSize: 13, fontWeight: mode === "dark" ? 700 : 500 }}>다크</span>
            </button>
          </div>
        </div>
      </div>
    </StudentPageShell>
  );
}
