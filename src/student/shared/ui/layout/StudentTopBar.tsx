/**
 * 상단 바 — 좌: 로고·타이틀 고정(박철과학 등) / 우: 학생 이름
 * 로고는 테넌트별 동적 import로 필요한 리소스만 로드 (모바일 초기 번들 경량화)
 */
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getStudentTenantBranding } from "@/student/shared/tenant/studentTenantBranding";
import { fetchMyProfile } from "@/student/domains/profile/api/profile";
import { getTenantCodeForApiRequest } from "@/shared/tenant";

type Props = { tenantCode: string | null };

export default function StudentTopBar({ tenantCode }: Props) {
  const branding = getStudentTenantBranding(tenantCode);
  const { data: profile } = useQuery({
    queryKey: ["student", "me"],
    queryFn: fetchMyProfile,
  });

  const currentTenantCode = getTenantCodeForApiRequest();
  const isTchulTheme = currentTenantCode != null && currentTenantCode === "tchul";
  const isCommonTheme = currentTenantCode != null && ["hakwonplus", "limglish", "ymath", "9999", "common"].includes(String(currentTenantCode));

  const [logoSrc, setLogoSrc] = useState<string | null>(null);
  useEffect(() => {
    if (isTchulTheme) {
      import("@/features/auth/pages/logos/TchulLogoIcon.png").then((m) => setLogoSrc(m.default));
    } else if (branding.useCommonLogo) {
      import("@/features/auth/pages/logos/commonlogo.png").then((m) => setLogoSrc(m.default));
    } else if (branding.logoUrl) {
      setLogoSrc(branding.logoUrl);
    } else {
      setLogoSrc(null);
    }
  }, [isTchulTheme, branding.useCommonLogo, branding.logoUrl]);

  const showLogoSrc = logoSrc != null && (isTchulTheme || branding.useCommonLogo || branding.logoUrl);

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
        {showLogoSrc ? (
          <img
            src={logoSrc}
            alt=""
            className="stu-topbar__logo"
            style={{
              height: 32,
              width: isTchulTheme ? 32 : "auto",
              maxWidth: isTchulTheme ? 32 : 120,
              objectFit: "contain",
              display: "block",
              flexShrink: 0,
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
