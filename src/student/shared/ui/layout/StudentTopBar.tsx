/**
 * 상단 바 — 좌: 로고·타이틀 / 우: 프로필(아바타+이름) 클릭 시 내정보·설정·로그아웃
 */
import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Dropdown } from "antd";
import { getStudentTenantBranding } from "@/student/shared/tenant/studentTenantBranding";
import { fetchMyProfile } from "@/student/domains/profile/api/profile";
import { getTenantCodeForApiRequest } from "@/shared/tenant";
import { logout } from "@/features/auth/api/auth";
import CommonLogoIcon from "@/features/auth/pages/logos/CommonLogoIcon";
import "@/student/shared/ui/theme/student-topbar.css";

type Props = { tenantCode: string | null };

function StudentAvatar({ profile }: { profile: { name?: string; profile_photo_url?: string | null } }) {
  const name = profile?.name?.trim() || "학생";
  const initial = name.slice(0, 1).toUpperCase();
  const photoUrl = profile?.profile_photo_url;

  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt=""
        className="stu-topbar__avatar-img"
        style={{ width: 28, height: 28, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }}
      />
    );
  }
  return (
    <span className="stu-topbar__avatar-initial" style={{ width: 28, height: 28, borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center", background: "var(--stu-primary)", color: "var(--stu-primary-contrast)", fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
      {initial}
    </span>
  );
}

export default function StudentTopBar({ tenantCode }: Props) {
  const navigate = useNavigate();
  const branding = getStudentTenantBranding(tenantCode);
  const { data: profile } = useQuery({
    queryKey: ["student", "me"],
    queryFn: fetchMyProfile,
  });

  const [profileOpen, setProfileOpen] = useState(false);
  const currentTenantCode = getTenantCodeForApiRequest();
  const isTchulTheme = currentTenantCode != null && currentTenantCode === "tchul";
  const [logoSrc, setLogoSrc] = useState<string | null>(null);
  useEffect(() => {
    if (isTchulTheme) {
      import("@/features/auth/pages/logos/TchulLogoIcon.png").then((m) => setLogoSrc(m.default));
    } else if (branding.logoUrl) {
      setLogoSrc(branding.logoUrl);
    } else {
      setLogoSrc(null);
    }
  }, [isTchulTheme, branding.logoUrl]);

  const useCommonSvgLogo = branding.useCommonLogo && !isTchulTheme;
  const showImgLogo = logoSrc != null && (isTchulTheme || branding.logoUrl);

  const profileDropdownContent = (
    <div className="stu-topbar__profileDropdown">
      <button
        type="button"
        className="stu-topbar__profileDropdownItem"
        onClick={() => {
          setProfileOpen(false);
          navigate("/student/profile");
        }}
      >
        내 정보
      </button>
      <button
        type="button"
        className="stu-topbar__profileDropdownItem"
        onClick={() => {
          setProfileOpen(false);
          navigate("/student/settings");
        }}
      >
        설정
      </button>
      <div className="stu-topbar__profileDropdownDivider" />
      <button
        type="button"
        className="stu-topbar__profileDropdownItem stu-topbar__profileDropdownItem--danger"
        onClick={() => {
          setProfileOpen(false);
          logout();
        }}
      >
        로그아웃
      </button>
    </div>
  );

  return (
    <div
      className="stu-topbar"
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
        {useCommonSvgLogo ? (
          <CommonLogoIcon height={32} style={{ width: "auto", maxWidth: 120 }} />
        ) : showImgLogo ? (
          <img
            src={logoSrc!}
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

      <Dropdown
        open={profileOpen}
        onOpenChange={setProfileOpen}
        trigger={["click"]}
        placement="bottomRight"
        dropdownRender={() => profileDropdownContent}
        dropdownClassName="stu-topbar__profileDropdownOverlay"
      >
        <button
          type="button"
          className="stu-topbar__profileBtn"
          aria-label="프로필 메뉴"
        >
          {profile ? (
            <StudentAvatar profile={profile} />
          ) : (
            <span className="stu-topbar__avatar-initial" style={{ width: 28, height: 28, borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center", background: "var(--stu-surface-soft)", color: "var(--stu-text-muted)", fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
              ?
            </span>
          )}
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
            {profile?.name || "학생"}
          </span>
        </button>
      </Dropdown>
    </div>
  );
}
