/**
 * PATH: src/app_teacher/layout/TeacherTopBar.tsx
 * 상단 바 — 좌: 햄버거 + 선생님 홈 / 학원 로고 + 이름 / 우: 알림(작업박스)
 *
 * 2026-05-12 학원장 spec:
 *   - 우상단은 알림/작업 영역. 글로브 제거 후 알림 종만 유지(향후 검색·계정 추가 자리).
 *   - 모바일에서 학원 로고가 안 박혀 있어서 브랜드 인지 약함 — program.logo_url 있으면 표시.
 *
 * 인라인 style baseline 면제 (모바일 헤더는 컴포넌트 전체가 token 기반 inline style로 운영).
 */
/* eslint-disable no-restricted-syntax */
import { useNavigate } from "react-router";
import { ICON } from "@/shared/ui/ds";
import { useProgram } from "@/shared/program";
import {
  getTenantBranding,
  getTenantHeaderCssVars,
  getTenantIdFromCode,
  resolveTenantCode,
} from "@/shared/tenant";
import { GuideBookLauncher, getGuideBookPreset } from "@/shared/ui/guide";
import { useTeacherPendingCounts } from "@teacher/shared/hooks/useTeacherPendingCounts";
import { Menu, Bell, BellRing, Search } from "@teacher/shared/ui/Icons";
interface Props {
  onMenuClick: () => void;
  onQuickNavigationClick: () => void;
  showMenuButton?: boolean;
}

const TEACHER_GUIDE_BOOK = getGuideBookPreset("teacher");

export default function TeacherTopBar({
  onMenuClick,
  onQuickNavigationClick,
  showMenuButton = true,
}: Props) {
  const navigate = useNavigate();
  const { program } = useProgram();
  const { counts } = useTeacherPendingCounts();
  const tenantName = program?.display_name?.trim() || "";
  const tenantResult = resolveTenantCode();
  const tenantId = tenantResult.ok ? getTenantIdFromCode(tenantResult.code) : null;
  const tenantBranding = tenantId ? getTenantBranding(tenantId) : null;
  const tenantHeaderLogoUrl = tenantBranding?.headerLogoUrl ?? "";
  const headerBrandStyle = getTenantHeaderCssVars(tenantBranding);
  const programLogoUrl = program?.ui_config?.logo_url?.trim() || "";
  const logoUrl = headerBrandStyle
    ? (tenantHeaderLogoUrl || programLogoUrl)
    : (programLogoUrl || tenantHeaderLogoUrl);
  const badge = counts?.total ?? 0;

  return (
    <div
      className="teacher-topbar"
      style={{
        ...headerBrandStyle,
        height: "var(--tc-header-h)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 var(--tc-space-3)",
        maxWidth: "var(--tc-page-max-w)",
        margin: "0 auto",
        width: "100%",
      }}
    >
      {/* Left: Hamburger + Tenant name */}
      <div style={{ display: "flex", alignItems: "center", gap: 4, flex: "1 1 auto", minWidth: 0, overflow: "hidden" }}>
        {showMenuButton && (
          <button
            onClick={onMenuClick}
            aria-label="메뉴"
            style={{
              background: "none",
              border: "none",
              padding: 8,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--tc-text-secondary)",
              borderRadius: "var(--tc-radius)",
              minWidth: "var(--tc-touch-min)",
              minHeight: "var(--tc-touch-min)",
            }}
          >
            <Menu size={ICON.lg} />
          </button>
        )}
        <button
          type="button"
          onClick={() => navigate("/workspace/mobile")}
          aria-label="선생님 홈으로 이동"
          title="선생님 홈으로 이동"
          data-testid="tc-topbar-go-dashboard"
          className="teacher-topbar__brand"
          data-tenant-header-brand={headerBrandStyle ? "" : undefined}
          style={{
            background: headerBrandStyle
              ? "linear-gradient(90deg, var(--tenant-header-surface) 0, var(--tenant-header-surface) 42px, var(--tenant-header-surface-soft) 70%, transparent 100%)"
              : "none",
            border: "none",
            padding: headerBrandStyle ? "5px 20px 5px 5px" : "8px 4px",
            cursor: "pointer",
            minHeight: "var(--tc-touch-min)",
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            flex: "1 1 auto",
            minWidth: 0,
            maxWidth: "min(44vw, 260px)",
            overflow: "hidden",
          }}
        >
          {logoUrl && (
            <img
              src={logoUrl}
              alt=""
              className="teacher-topbar__logo"
              style={{
                height: headerBrandStyle ? 32 : 26,
                width: headerBrandStyle ? 32 : "auto",
                maxWidth: headerBrandStyle ? 32 : 80,
                objectFit: headerBrandStyle ? "cover" : "contain",
                display: "block",
              }}
            />
          )}
          {tenantName ? (
            <span
              style={{
                fontSize: 17,
                fontWeight: 700,
                color: headerBrandStyle ? "var(--tenant-header-foreground)" : "var(--tc-text)",
                letterSpacing: 0,
                minWidth: 0,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {tenantName}
            </span>
          ) : !logoUrl ? (
            <span
              aria-hidden
              style={{
                display: "inline-block",
                width: 96,
                height: 16,
                borderRadius: 6,
                background: "var(--tc-surface-soft)",
              }}
            />
          ) : null}
        </button>
      </div>

      {/* Right: 빠른 이동·가이드·알림. 홈은 좌측 브랜드 버튼 하나가 소유한다. */}
      <div style={{ display: "flex", alignItems: "center", gap: 0, flexShrink: 0 }}>
        <button
          type="button"
          onClick={onQuickNavigationClick}
          aria-label="빠른 이동"
          aria-keyshortcuts="Control+K Meta+K"
          title="빠른 이동"
          style={{
            background: "none",
            border: "none",
            padding: 8,
            cursor: "pointer",
            borderRadius: "var(--tc-radius-full)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--tc-text-secondary)",
            minWidth: "var(--tc-touch-min)",
            minHeight: "var(--tc-touch-min)",
          }}
        >
          <Search size={ICON.lg} />
        </button>
        <GuideBookLauncher
          preset={TEACHER_GUIDE_BOOK}
          tone="teacher"
          buttonClassName="teacher-topbar__guideBtn"
          iconSize={ICON.lg}
          ariaLabel="가이드북"
          onNavigate={navigate}
        />
        <button
          onClick={() => navigate("/workspace/mobile/notifications")}
          aria-label={badge > 0 ? `알림 ${badge > 99 ? "99건 이상" : `${badge}건`}` : "알림"}
          style={{
            background: "none",
            border: "none",
            padding: 8,
            cursor: "pointer",
            borderRadius: "var(--tc-radius-full)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: badge > 0 ? "var(--tc-text)" : "var(--tc-text-secondary)",
            position: "relative",
            minWidth: "var(--tc-touch-min)",
            minHeight: "var(--tc-touch-min)",
          }}
        >
          {badge > 0 ? <BellRing size={ICON.lg} /> : <Bell size={ICON.lg} />}
          {badge > 0 && (
            <span
              style={{
                position: "absolute",
                top: 4,
                right: 4,
                minWidth: 16,
                height: 16,
                lineHeight: "16px",
                fontSize: 9,
                fontWeight: 700,
                textAlign: "center",
                borderRadius: 8,
                padding: "0 4px",
                background: "var(--tc-danger)",
                color: "#fff",
              }}
            >
              {badge > 99 ? "99+" : badge}
            </span>
          )}
        </button>
      </div>
    </div>
  );
}
