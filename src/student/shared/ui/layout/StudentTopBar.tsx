/**
 * 상단 바 — 미니멀 (로고 + 제목만), 유튜브 모바일형
 */
import { Link, useLocation } from "react-router-dom";

export default function StudentTopBar() {
  const loc = useLocation();
  const isHome = loc.pathname === "/student" || loc.pathname.startsWith("/student/dashboard");

  return (
    <div
      style={{
        height: "var(--stu-header-h)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 var(--stu-space-4)",
        maxWidth: "var(--stu-page-max-w)",
        margin: "0 auto",
      }}
    >
      <Link
        to="/student/dashboard"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 10,
          color: "var(--stu-text)",
          textDecoration: "none",
        }}
        aria-label="홈"
      >
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 10,
            background: "var(--stu-primary)",
            color: "var(--stu-primary-contrast)",
            display: "grid",
            placeItems: "center",
            fontWeight: 800,
            fontSize: 14,
          }}
        >
          H
        </div>
        <span style={{ fontWeight: 800, fontSize: 15, letterSpacing: "-0.3px" }}>
          {isHome ? "학원플러스" : "학생"}
        </span>
      </Link>
    </div>
  );
}
