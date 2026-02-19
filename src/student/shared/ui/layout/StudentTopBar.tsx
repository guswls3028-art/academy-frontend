/**
 * 상단 바 — 좌: 로고·타이틀 고정(박철과학 등) / 우: 학생 아바타 + 이름
 */
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getStudentTenantBranding } from "@/student/shared/tenant/studentTenantBranding";
import { fetchMyProfile } from "@/student/domains/profile/api/profile";
import { getTenantCodeForApiRequest } from "@/shared/tenant";
import TchulLogoIcon from "@/features/auth/pages/logos/TchulLogoIcon.png";

type Props = { tenantCode: string | null };

const AVATAR_SIZE = 28;

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
          <div
            style={{
              width: 36,
              height: 36,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "6px 0",
            }}
          >
            <img
              src={TchulLogoIcon}
              alt=""
              style={{
                height: "100%",
                width: "auto",
                objectFit: "contain",
                display: "block",
              }}
            />
          </div>
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
          <>
            <div
              style={{
                width: AVATAR_SIZE,
                height: AVATAR_SIZE,
                borderRadius: "50%",
                overflow: "hidden",
                flexShrink: 0,
                background: "var(--stu-surface-soft)",
                border: "1px solid var(--stu-border)",
                display: "grid",
                placeItems: "center",
                fontSize: 12,
                fontWeight: 800,
                color: "var(--stu-primary)",
              }}
            >
              {profile.profile_photo_url ? (
                <img
                  src={profile.profile_photo_url}
                  alt=""
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : (
                (profile.name || "?")[0]
              )}
            </div>
            <span
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
          </>
        )}
      </div>
    </div>
  );
}
