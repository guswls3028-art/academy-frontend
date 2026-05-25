/**
 * PATH: src/app_teacher/layout/TeacherTopBar.tsx
 * 상단 바 — 좌: 햄버거 + 학원 홈 / 학원 로고 + 이름 / 우: 알림(작업박스)
 *
 * 2026-05-12 학원장 spec:
 *   - 좌상단 홈 아이콘 / 우상단 글로브 두 동선이 모두 /landing 으로 중복 — 우상단 글로브 제거.
 *   - 우상단은 알림/작업 영역. 글로브 제거 후 알림 종만 유지(향후 검색·계정 추가 자리).
 *   - 모바일에서 학원 로고가 안 박혀 있어서 브랜드 인지 약함 — program.logo_url 있으면 표시.
 *
 * 인라인 style baseline 면제 (모바일 헤더는 컴포넌트 전체가 token 기반 inline style로 운영).
 */
/* eslint-disable no-restricted-syntax */
import { useNavigate } from "react-router-dom";
import { ICON } from "@/shared/ui/ds";
import { useProgram } from "@/shared/program";
import { useTeacherPendingCounts } from "@teacher/shared/hooks/useTeacherPendingCounts";
import { Menu, Bell, BellRing } from "@teacher/shared/ui/Icons";
interface Props {
  onMenuClick: () => void;
}

export default function TeacherTopBar({ onMenuClick }: Props) {
  const navigate = useNavigate();
  const { program } = useProgram();
  const { counts } = useTeacherPendingCounts();
  const tenantName = program?.display_name?.trim() || "";
  const logoUrl = program?.ui_config?.logo_url?.trim() || "";
  const badge = counts?.total ?? 0;

  return (
    <div
      style={{
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
        {/* 2026-05-12: 학원 홈페이지로 이동 — 햄버거와 동일 size icon-only(시각 일관성) */}
        <a
          href="/landing"
          aria-label="학원 홈페이지로 이동"
          title="학원 홈페이지로 이동"
          data-testid="tc-topbar-go-home"
          style={{
            padding: 8,
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "var(--tc-text-secondary)",
            borderRadius: "var(--tc-radius)",
            minWidth: "var(--tc-touch-min)",
            minHeight: "var(--tc-touch-min)",
            textDecoration: "none",
          }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 12L12 4l9 8" />
            <path d="M5 10v10h14V10" />
          </svg>
        </a>
        <button
          onClick={() => navigate("/teacher")}
          aria-label="홈으로"
          style={{
            background: "none",
            border: "none",
            padding: "8px 4px",
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
              style={{ height: 26, width: "auto", maxWidth: 80, objectFit: "contain", display: "block" }}
            />
          )}
          {tenantName ? (
            <span
              style={{
                fontSize: 17,
                fontWeight: 700,
                color: "var(--tc-text)",
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

      {/* Right: 작업박스 영역 — 알림 벨(향후 검색·계정 등 추가 자리).
          학원 홈페이지 동선은 좌상단 홈 아이콘이 SSOT (2026-05-12 학원장 spec, 중복 제거). */}
      <div style={{ display: "flex", alignItems: "center", gap: 0, flexShrink: 0 }}>
      <button
        onClick={() => navigate("/teacher/notifications")}
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
