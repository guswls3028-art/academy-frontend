/**
 * 더보기 — 프로필, 게시판, 출결, 클리닉 인증 등
 */
import { Link } from "react-router-dom";
import { logout } from "@/features/auth/api/auth";
import {
  IconUser,
  IconBoard,
  IconClipboard,
  IconCheck,
  IconExam,
  IconGrade,
  IconLogout,
} from "@/student/shared/ui/icons/Icons";

const linkStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "var(--stu-space-4)",
  padding: "var(--stu-space-4) var(--stu-space-4)",
  borderRadius: "var(--stu-radius-md)",
  background: "var(--stu-surface)",
  border: "1px solid var(--stu-border)",
  color: "var(--stu-text)",
  textDecoration: "none",
  fontWeight: 700,
  fontSize: 15,
  marginBottom: "var(--stu-space-2)",
};

export default function MorePage() {
  return (
    <div style={{ padding: "var(--stu-space-2) 0" }}>
      <h1 style={{ fontSize: 20, fontWeight: 800, marginBottom: "var(--stu-space-6)", paddingLeft: "var(--stu-space-2)" }}>
        더보기
      </h1>

      <section style={{ marginBottom: "var(--stu-space-8)" }}>
        <h2 className="stu-muted" style={{ fontSize: 12, fontWeight: 800, marginBottom: "var(--stu-space-3)", paddingLeft: 4 }}>
          학습
        </h2>
        <Link to="/student/exams" style={linkStyle}>
          <IconExam style={{ width: 22, height: 22, flexShrink: 0 }} />
          시험
        </Link>
        <Link to="/student/grades" style={linkStyle}>
          <IconGrade style={{ width: 22, height: 22, flexShrink: 0 }} />
          성적
        </Link>
      </section>

      <section style={{ marginBottom: "var(--stu-space-8)" }}>
        <h2 className="stu-muted" style={{ fontSize: 12, fontWeight: 800, marginBottom: "var(--stu-space-3)", paddingLeft: 4 }}>
          소통
        </h2>
        <Link to="/student/qna" style={linkStyle}>
          <IconBoard style={{ width: 22, height: 22, flexShrink: 0 }} />
          Q&amp;A 게시판
        </Link>
      </section>

      <section style={{ marginBottom: "var(--stu-space-8)" }}>
        <h2 className="stu-muted" style={{ fontSize: 12, fontWeight: 800, marginBottom: "var(--stu-space-3)", paddingLeft: 4 }}>
          기타
        </h2>
        <Link to="/student/attendance" style={linkStyle}>
          <IconClipboard style={{ width: 22, height: 22, flexShrink: 0 }} />
          출결 현황
        </Link>
        <Link to="/student/idcard" style={linkStyle}>
          <IconCheck style={{ width: 22, height: 22, flexShrink: 0 }} />
          클리닉 인증
        </Link>
        <Link to="/student/profile" style={linkStyle}>
          <IconUser style={{ width: 22, height: 22, flexShrink: 0 }} />
          프로필
        </Link>
      </section>

      <section>
        <button
          type="button"
          className="stu-btn stu-btn--ghost"
          style={{ ...linkStyle, width: "100%", marginBottom: 0, justifyContent: "center", border: "1px solid var(--stu-danger)" }}
          onClick={() => {
            // 로그아웃: 공유 auth 로직 사용 (다른 영역 침범 최소화 — window.location 또는 auth context)
            const base = window.location.origin;
            window.location.href = `${base}/logout/` || `${base}/api/logout/`;
          }}
        >
          <IconLogout style={{ width: 22, height: 22 }} />
          로그아웃
        </button>
      </section>
    </div>
  );
}

