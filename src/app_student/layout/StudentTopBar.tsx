/**
 * 상단 바 — 좌: 로고·타이틀 / 우: 프로필(아바타+이름) 클릭 시 내정보·설정·로그아웃
 */
import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getStudentTenantBranding } from "@student/shared/tenant/studentTenantBranding";
import { fetchMyProfile } from "@student/domains/profile/api/profile.api";
import { getTenantCodeForApiRequest, getTenantIdFromCode, getTenantBranding } from "@/shared/tenant";
import { logout } from "@/auth/api/auth.api";
import { useAuthContext } from "@/auth/context/AuthContext";
import { setParentStudentId, getParentStudentId } from "@student/shared/api/parentStudentSelection";
import { useStudentTheme } from "@student/shared/context/StudentThemeContext";
import CommonLogoIcon from "@/auth/assets/CommonLogoIcon";
import TchulLogoIcon from "@/auth/assets/TchulLogoIcon";
import "@student/shared/ui/theme/student-topbar.css";

type Props = { tenantCode: string | null; onMenuClick?: () => void };

function StudentAvatar({ profile }: { profile: { name?: string; profile_photo_url?: string | null; displayName?: string | null; isParentReadOnly?: boolean } }) {
  const displayLabel = profile?.isParentReadOnly && profile?.displayName
    ? profile.displayName
    : (profile?.name?.trim() || "학생");
  const initial = displayLabel.slice(0, 1).toUpperCase();
  const photoUrl = profile?.profile_photo_url;

  if (photoUrl && !profile?.isParentReadOnly) {
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

function IconSun({ style }: { style?: React.CSSProperties }) {
  return (
    <svg style={style} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
  );
}

function IconMoon({ style }: { style?: React.CSSProperties }) {
  return (
    <svg style={style} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

export default function StudentTopBar({ tenantCode, onMenuClick }: Props) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuthContext();
  const { isDark, toggleMode } = useStudentTheme();
  const branding = getStudentTenantBranding(tenantCode);
  const { data: profile } = useQuery({
    queryKey: ["student", "me"],
    queryFn: fetchMyProfile,
    staleTime: 30_000,
  });

  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!profileOpen) return;
    const handler = (e: MouseEvent | TouchEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, [profileOpen]);
  const currentTenantCode = getTenantCodeForApiRequest();
  const isTchulTheme = currentTenantCode != null && currentTenantCode === "tchul";
  // 테넌트 브랜딩에서 헤더 전용 로고 URL 가져오기
  const currentTenantId = currentTenantCode ? getTenantIdFromCode(currentTenantCode) : null;
  const tenantBrandingData = currentTenantId ? getTenantBranding(currentTenantId) : null;
  const headerLogoUrl = isDark
    ? (tenantBrandingData?.headerLogoDarkUrl ?? tenantBrandingData?.headerLogoUrl ?? null)
    : (tenantBrandingData?.headerLogoUrl ?? null);

  const [logoSrc, setLogoSrc] = useState<string | null>(null);
  useEffect(() => {
    if (!isTchulTheme && !headerLogoUrl && branding.logoUrl) {
      setLogoSrc(branding.logoUrl);
    } else {
      setLogoSrc(null);
    }
  }, [isTchulTheme, headerLogoUrl, branding.logoUrl]);

  const useCommonSvgLogo = branding.useCommonLogo && !isTchulTheme && !headerLogoUrl;
  const showImgLogo = logoSrc != null && !isTchulTheme && !headerLogoUrl;

  const profileDropdownContent = (
    <div className="stu-topbar__profileDropdown">
      {profile?.isParentReadOnly && (user?.linkedStudents?.length ?? 0) > 1 && (
        <>
          <div className="stu-topbar__profileDropdownLabel" style={{ padding: "8px 12px", fontSize: 12, color: "var(--stu-text-muted)", fontWeight: 600 }}>
            자녀 선택
          </div>
          {(user?.linkedStudents ?? []).map((s) => (
            <button
              key={s.id}
              type="button"
              className="stu-topbar__profileDropdownItem"
              style={{ fontWeight: getParentStudentId() === s.id ? 700 : 400 }}
              onClick={() => {
                setParentStudentId(s.id);
                setProfileOpen(false);
                // 자녀 전환 시 모든 학생 캐시 무효화 (배열 키 + 하이픈 키)
                // 자녀 전환: 모든 캐시 무효화 (배열 키 + 하이픈 키 모두 포함)
                qc.clear();
                navigate("/student/dashboard");
              }}
            >
              {s.name}
            </button>
          ))}
          <div className="stu-topbar__profileDropdownDivider" />
        </>
      )}
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
          toggleMode();
        }}
        style={{ display: "flex", alignItems: "center", gap: 8 }}
      >
        {isDark ? <IconSun style={{ width: 16, height: 16, flexShrink: 0 }} /> : <IconMoon style={{ width: 16, height: 16, flexShrink: 0 }} />}
        {isDark ? "라이트 모드" : "다크 모드"}
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
      <button
        type="button"
        className="stu-topbar__profileDropdownItem"
        onClick={() => {
          setProfileOpen(false);
          navigate("/student/guide");
        }}
      >
        사용 가이드
      </button>
      <button
        type="button"
        className="stu-topbar__profileDropdownItem"
        onClick={() => {
          setProfileOpen(false);
          document.dispatchEvent(new Event("ui:bugreport:open"));
        }}
      >
        문제 신고
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
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      {/* 햄버거 메뉴 버튼 */}
      {onMenuClick && (
        <button
          type="button"
          onClick={onMenuClick}
          aria-label="메뉴 열기"
          className="stu-topbar__menuBtn"
          style={{
            width: 44,
            height: 44,
            display: "grid",
            placeItems: "center",
            background: "transparent",
            border: "none",
            borderRadius: "var(--stu-radius-sm)",
            cursor: "pointer",
            color: "var(--stu-text)",
            padding: 0,
            flexShrink: 0,
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
      )}
      <Link
        to="/student/dashboard"
        className="stu-topbar__home-link"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          color: "var(--stu-text)",
          textDecoration: "none",
          minWidth: 0,
        }}
        aria-label="홈"
      >
        {headerLogoUrl ? (
          <img
            src={headerLogoUrl}
            alt=""
            className="stu-topbar__logo"
            style={{ height: 32, width: "auto", maxWidth: 40, objectFit: "contain", display: "block", flexShrink: 0 }}
          />
        ) : useCommonSvgLogo ? (
          <CommonLogoIcon height={32} style={{ width: "auto", maxWidth: 120 }} />
        ) : isTchulTheme ? (
          <TchulLogoIcon
            height={32}
            style={{ width: 32, flexShrink: 0, display: "block" }}
            className="stu-topbar__logo"
          />
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
        ) : null}
        {!headerLogoUrl && !useCommonSvgLogo && !isTchulTheme && !showImgLogo ? (
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
        ) : null}
        <span style={{ fontWeight: 700, fontSize: 15, letterSpacing: "-0.02em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {branding.title}
        </span>
      </Link>
      </div>

      <div ref={profileRef} style={{ position: "relative" }}>
        <button
          type="button"
          className="stu-topbar__profileBtn"
          aria-label="프로필 메뉴"
          onClick={() => setProfileOpen((v) => !v)}
        >
          {profile ? (
            <StudentAvatar profile={profile} />
          ) : (
            <span className="stu-topbar__avatar-initial" style={{ width: 28, height: 28, borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center", background: "var(--stu-surface-soft)", color: "var(--stu-text-muted)", fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
              ?
            </span>
          )}
          {profile?.isParentReadOnly && profile?.displayName && (
            <span
              className="stu-topbar__name"
              style={{
                fontWeight: 600,
                fontSize: 13,
                color: "var(--stu-text-muted)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                maxWidth: 100,
                letterSpacing: "-0.01em",
              }}
            >
              {profile.displayName}
            </span>
          )}
        </button>
        {profileOpen && (
          <div
            className="stu-topbar__profileDropdownOverlay"
            style={{
              position: "absolute",
              top: "calc(100% + 4px)",
              right: 0,
              zIndex: 1050,
            }}
          >
            {profileDropdownContent}
          </div>
        )}
      </div>
    </div>
  );
}
