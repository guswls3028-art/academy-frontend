/**
 * 상단 바 — 테넌트별 로고·타이틀 (studentTenantBranding SSOT)
 */
import { Link, useLocation } from "react-router-dom";
import { getStudentTenantBranding } from "@/student/shared/tenant/studentTenantBranding";

type Props = { tenantCode: string | null };

export default function StudentTopBar({ tenantCode }: Props) {
  const loc = useLocation();
  const isHome = loc.pathname === "/student" || loc.pathname.startsWith("/student/dashboard");
  const branding = getStudentTenantBranding(tenantCode);

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
        {branding.logoUrl ? (
          <img
            src={branding.logoUrl}
            alt=""
            style={{
              height: 32,
              width: "auto",
              maxWidth: 120,
              objectFit: "contain",
            }}
          />
        ) : (
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
        )}
        <span style={{ fontWeight: 800, fontSize: 15, letterSpacing: "-0.3px" }}>
          {isHome ? branding.title : "학생"}
        </span>
      </Link>
    </div>
  );
}
