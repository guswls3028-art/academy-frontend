/**
 * 상단 바 — 좌: 로고·타이틀 고정(박철과학 등) / 우: 학생 이름
 */
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getStudentTenantBranding } from "@/student/shared/tenant/studentTenantBranding";
import { fetchMyProfile } from "@/student/domains/profile/api/profile";
import { getTenantCodeForApiRequest } from "@/shared/tenant";
import TchulLogoIcon from "@/features/auth/pages/logos/TchulLogoIcon.png";

type Props = { tenantCode: string | null };

export default function StudentTopBar({ tenantCode }: Props) {
  const branding = getStudentTenantBranding(tenantCode);
  const { data: profile } = useQuery({
    queryKey: ["student", "me"],
    queryFn: fetchMyProfile,
  });
  
  const currentTenantCode = getTenantCodeForApiRequest();
  const isTchulTheme = currentTenantCode != null && ["tchul", "9999"].includes(String(currentTenantCode));

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
        className="stu-topbar__home-link"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 10,
          color: "var(--stu-text)",
          textDecoration: "none",
        }}
        aria-label="홈"
      >
        {isTchulTheme ? (
          <img
            src={TchulLogoIcon}
            alt=""
            className="stu-topbar__logo"
            style={{
              height: 32,
              width: 32,
              objectFit: "contain",
              display: "block",
              flexShrink: 0,
            }}
          />
        ) : branding.logoUrl ? (
          <img
            src={branding.logoUrl}
            alt=""
            style={{
              height: 32,
              width: "auto",
              maxWidth: 120,
              objectFit: "contain",
              display: "block",
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
          {branding.title}
        </span>
      </Link>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          minWidth: 0,
        }}
      >
        {profile && (
          <span
            className="stu-topbar__name"
            style={{
              fontWeight: 700,
              fontSize: 14,
              color: "var(--stu-text)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              maxWidth: 100,
            }}
          >
            {profile.name || "학생"}
          </span>
        )}
      </div>
    </div>
  );
}
