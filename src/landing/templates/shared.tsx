// PATH: src/app_admin/domains/landing/templates/shared.tsx
// 공통 렌더링 유틸. 모든 템플릿에서 사용.
//
// 랜딩 템플릿 도메인 — inline style 면제 + 기존 시그니처 호환 (color/borderColor 등 일부 unused 파라미터).
/* eslint-disable no-restricted-syntax, @typescript-eslint/no-unused-vars, react-refresh/only-export-components */

import type { LandingConfig, LandingSection, FeatureItem, TestimonialItem, ProgramItem, FaqItem, HitReportShowcaseItem, HitReportPublicCard } from "../types";
import { useState, useEffect, useRef } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { scrollToLandingSection } from "../utils/scrollToSection";
import useAuth from "@/auth/hooks/useAuth";
import api, { type ApiRequestConfig, saveReturnPath } from "@/shared/api/axios";
import { resolveTenantCode, getTenantIdFromCode, getTenantBranding } from "@/shared/tenant";
import { fetchPublicHitReportsCached, hitReportIdsKey, normalizeHitReportIds } from "../api/hitReports";

/** 아이콘 매핑 (SVG 인라인) */
const ICON_MAP: Record<string, string> = {
  book: "M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253",
  chart: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z",
  users: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z",
  star: "M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z",
  shield: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z",
  clock: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z",
  check: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
  heart: "M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z",
  target: "M9 12l2 2 4-4M7.835 4.697A3.42 3.42 0 001.946 9.12a3.42 3.42 0 005.89 3.42M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  award: "M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z",
};

export function SvgIcon({ name, size = 24, className = "" }: { name: string; size?: number; className?: string }) {
  const d = ICON_MAP[name] || ICON_MAP.star;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d={d} />
    </svg>
  );
}

/** enabled 섹션만 order 순 정렬 */
export function getEnabledSections(config: LandingConfig): LandingSection[] {
  return [...(config.sections || [])]
    .filter((s) => s.enabled)
    .sort((a, b) => a.order - b.order);
}

/** FAQ 아코디언 아이템 */
export function FaqAccordion({ items, color }: { items: FaqItem[]; color: string }) {
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {items.map((item, i) => (
        <div key={i} style={{ borderBottom: "1px solid rgba(0,0,0,0.08)" }}>
          <button
            onClick={() => setOpenIdx(openIdx === i ? null : i)}
            style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              width: "100%", padding: "20px 0", background: "none", border: "none",
              cursor: "pointer", fontSize: 16, fontWeight: 500, textAlign: "left",
              color: "inherit",
            }}
          >
            <span>{item.question}</span>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              style={{ transform: openIdx === i ? "rotate(180deg)" : "none", transition: "transform 0.2s", flexShrink: 0, marginLeft: 16 }}>
              <path d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {openIdx === i && (
            <div style={{ padding: "0 0 20px", color: "rgba(0,0,0,0.6)", fontSize: 15, lineHeight: 1.7 }}>
              {item.answer}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export interface TemplateProps {
  config: LandingConfig;
  isPreview?: boolean;
}

/** 로고 URL 결정 — kind별 의미 분리.
 *
 * - kind="nav" (헤더 nav 등 작은 영역): 테넌트 brandingHeaderLogoUrl(아이콘) 우선 → logo_url(학원장 업로드) 폴백 → branding.logoUrl 폴백.
 *   nav는 36~40px 작은 영역이라 슬로건 포함 큰 logo는 시각적으로 깨짐(노이즈/blur).
 * - kind="main" (히어로 등 큰 영역): logo_url(학원장 업로드) 우선 → branding.logoUrl(로그인 페이지 큰 로고) 폴백.
 *
 * 학원장이 어드민에서 logo_url 업로드 시 둘 다 사용. 미업로드 시 테넌트 SSOT branding 분리 적용.
 */
export function useResolvedLogo(config: LandingConfig, kind: "nav" | "main" = "main"): string | null {
  const tc = resolveTenantCode();
  const tid = tc.ok ? getTenantIdFromCode(tc.code) : null;
  const branding = tid ? getTenantBranding(tid) : null;
  if (kind === "nav") {
    return branding?.headerLogoUrl || config.logo_url || branding?.logoUrl || null;
  }
  return config.logo_url || branding?.logoUrl || branding?.headerLogoUrl || null;
}

/** hero primary CTA resolve — fallback chain:
 *   hero section.hero_primary_cta(section-level) → config.hero_primary_cta(global) → config.cta_text/cta_link
 */
export function resolveHeroPrimaryCta(config: LandingConfig, heroSection?: LandingSection | null): { label: string; link: string; isInternal: boolean } {
  const cta = heroSection?.hero_primary_cta || config.hero_primary_cta;
  const variant = cta?.variant || "consult";
  if (variant === "matchup") {
    return { label: cta?.label || "적중 보고서 보기", link: "/landing/reports", isInternal: true };
  }
  if (variant === "video") {
    return { label: cta?.label || "강의 영상 보기", link: cta?.link || config.cta_link || "/login", isInternal: false };
  }
  if (variant === "custom") {
    return { label: cta?.label || config.cta_text || "자세히 보기", link: cta?.link || config.cta_link || "/login", isInternal: false };
  }
  // consult (default)
  return { label: config.cta_text || "수강 문의", link: config.cta_link || "/login", isInternal: false };
}

/** 섹션 anchor 라벨 SSOT — nav 메뉴에 노출할 섹션과 한국어 라벨 */
export const NAV_SECTION_ANCHORS: Record<string, string> = {
  instructor_profile: "강사 소개",
  features: "수업 특징",
  management_system: "학생 관리",
  process_timeline: "수업 흐름",
  hit_reports: "적중 사례",
  programs: "프로그램",
  testimonials: "후기",
  faq: "자주 묻는 질문",
  contact: "문의",
};

/** 사이드 햄버거 패널 메뉴 SSOT — nexon dnfm 스타일 카테고리 그루핑.
 *
 * 학원장이 enable한 sections만 자동 노출됨. 공개 랜딩의 1차 진입은 외부 학부모가
 * 바로 볼 수 있는 route/section으로 맞추고, family-only route는 보조 항목으로만 유지한다.
 */
type NavMenuKind = "section" | "route";
interface NavMenuItem { key: string; label: string; kind: NavMenuKind; target: string; badge?: string }
interface NavMenuCategory { key: string; label: string; items: NavMenuItem[] }

function buildMenuCategories(sections: LandingSection[], isOwner: boolean = false): NavMenuCategory[] {
  const enabledTypes = new Set<string>(sections.filter((s) => s.enabled).map((s) => s.type));
  const has = (t: string) => enabledTypes.has(t);
  const categories: NavMenuCategory[] = [];

  // SSOT 순서 (학원장 spec 2026-05-12): 학원소개 → 커뮤니티 → 매치업 → 가이드 → 서비스센터.
  // owner 시점에는 "수정하기" 카테고리가 최하단에 추가됨 (학원장 spec 2026-05-13).

  // 1. 학원소개 — dedicated route page first (학원장 spec 2026-05-13 "헤더 메뉴 별로 라우트 구조").
  // sections는 메인 페이지의 anchor scroll로 보조. inline nav 가 route 우선 선택 (LandingNavBar).
  const aboutItems: NavMenuItem[] = [
    { key: "about_page", label: "학원 소개 (전체)", kind: "route", target: "/landing/about" },
  ];
  if (has("instructor_profile")) aboutItems.push({ key: "instructor_profile", label: "강사 소개", kind: "section", target: "instructor_profile" });
  if (has("features")) aboutItems.push({ key: "features", label: "수업 특징", kind: "section", target: "features" });
  if (has("management_system")) aboutItems.push({ key: "management_system", label: "학생 관리", kind: "section", target: "management_system" });
  if (has("process_timeline")) aboutItems.push({ key: "process_timeline", label: "수업 흐름", kind: "section", target: "process_timeline" });
  if (has("programs")) aboutItems.push({ key: "programs", label: "프로그램", kind: "section", target: "programs" });
  categories.push({ key: "about", label: "학원소개", items: aboutItems });

  // 2. 커뮤니티 — 공개 자유게시판을 1차 진입점으로 사용.
  // QnA/공지/자료실은 학원 family 권한이 필요한 내부 커뮤니티 route라 보조 항목으로 유지.
  categories.push({
    key: "community",
    label: "커뮤니티",
    items: [
      { key: "board", label: "자유게시판", kind: "route", target: "/landing/board" },
      { key: "qna", label: "질문게시판", kind: "route", target: "/landing/community/qna" },
      { key: "notice", label: "공지사항", kind: "route", target: "/landing/community/notice" },
      { key: "materials", label: "자료실", kind: "route", target: "/landing/community/materials" },
    ],
  });

  // 3. 매치업 / 적중사례 — 학원장 핵심 마케팅.
  // 테넌트2 운영 데이터 기준: 게시판 쇼케이스가 비어 있어도 hit_reports 보고서는 공개되어 있다.
  // 따라서 "매치업" 1차 진입은 실제 보고서 목록(/landing/reports)으로 연결한다.
  {
    const matchupItems: NavMenuItem[] = [];
    if (has("hit_reports")) {
      matchupItems.push({ key: "reports_all", label: "적중 보고서", kind: "route", target: "/landing/reports", badge: "LIVE" });
      matchupItems.push({ key: "hit_reports", label: "적중 사례 요약 (홈)", kind: "section", target: "hit_reports" });
    } else {
      matchupItems.push({ key: "matchup_board", label: "적중보고서 게시판", kind: "route", target: "/landing/matchup-board", badge: "NEW" });
    }
    categories.push({ key: "matchup", label: "매치업", items: matchupItems });
  }

  // 4. 가이드 — dedicated route page first (학원장 spec 2026-05-13 "헤더 메뉴 별로 라우트 구조")
  const guideItems: NavMenuItem[] = [
    { key: "guide_page", label: "가이드 전체", kind: "route", target: "/landing/guide" },
  ];
  if (has("faq")) guideItems.push({ key: "faq", label: "자주 묻는 질문 (홈)", kind: "section", target: "faq" });
  categories.push({ key: "guide", label: "가이드", items: guideItems });

  // 5. 서비스센터
  const serviceItems: NavMenuItem[] = [];
  if (has("contact")) serviceItems.push({ key: "contact", label: "상담 문의", kind: "section", target: "contact" });
  if (has("testimonials")) serviceItems.push({ key: "testimonials", label: "추천사", kind: "section", target: "testimonials" });
  serviceItems.push({ key: "reviews", label: "수강 후기", kind: "route", target: "/landing/reviews" });
  if (serviceItems.length) categories.push({ key: "service", label: "서비스센터", items: serviceItems });

  // 6. 수정하기 (owner/admin 전용) — 학원장 spec 2026-05-13.
  // "내 홈피 어떻게 수정?" / "매치업 게시 어떻게?" 호소 대응 — 사이드바에서 1클릭 진입.
  if (isOwner) {
    categories.push({
      key: "owner",
      label: "수정하기 (학원장)",
      items: [
        { key: "edit_page", label: "페이지 편집 (브랜드/히어로)", kind: "route", target: "/landing?edit=1" },
        { key: "matchup_board", label: "매치업 적중보고서 게시판 관리", kind: "route", target: "/landing/admin/matchup-board", badge: "NEW" },
      ],
    });
  }

  return categories;
}

function selectInlineNavItem(cat: NavMenuCategory): NavMenuItem {
  if (cat.key === "service") {
    return cat.items[0];
  }
  if (cat.key === "matchup") {
    return cat.items.find((it) => it.key === "reports_all") || cat.items.find((it) => it.kind === "route") || cat.items[0];
  }
  return cat.items.find((it) => it.kind === "route") || cat.items[0];
}

/** 공통 NavBar — light/dark 톤만 prop으로 받음. PremiumDark/MinimalTutor 모두 사용.
 *
 * 모든 viewport: 로고 + 우측(역할/CTA) + 햄버거 → 카테고리 그루핑 사이드 패널.
 * 가로 메뉴 X (학원장 요청 2026-05-11: nexon dnfm 스타일로 깔끔하게 치울 수 있어야).
 */
export interface NavBarTokens {
  bg: string;
  border: string;
  textPrimary: string;
  textSecondary: string;
  primaryColor: string;
  primaryRgb: string;
  ctaGradient: string;
  ctaTextColor: string;
  panelBg: string;
}

export function LandingNavBar({ config, sections, tokens, brandMark }: { config: LandingConfig; sections: LandingSection[]; tokens: NavBarTokens; brandMark: React.ReactNode; mobileBreakpoint?: number }) {
  const [open, setOpen] = useState(false);
  const cta = config.cta_text || "수강 문의";
  const ctaLink = config.cta_link || "/login";
  const logoUrl = useResolvedLogo(config, "nav");
  const isDark = tokens.bg.includes("10,14,26");
  const { user } = useAuth();
  const isOwner = !!(user?.is_superuser || user?.tenantRole === "owner" || user?.tenantRole === "admin");
  const categories = buildMenuCategories(sections, isOwner);
  const navigate = useNavigate();
  const location = useLocation();

  // 데스크탑 가로 nav 항목 — 카테고리별 실제 1차 사용자 목표를 선택.
  // 예: 매치업은 보고서 목록, 서비스센터는 빈 후기 route가 아니라 상담 문의 섹션.
  const inlineNav: Array<{ key: string; label: string; item: NavMenuItem }> = [];
  for (const cat of categories) {
    if (cat.items.length === 0) continue;
    if (cat.key === "owner") continue;  // owner 카테고리는 햄버거 패널 안에서만 노출
    const item = selectInlineNavItem(cat);
    inlineNav.push({ key: cat.key, label: cat.label, item });
  }

  // 메뉴 클릭 — section type이면 hash, route면 navigate. /landing 외 페이지에서도 cross-page 작동.
  // scroll offset은 SSOT 유틸 사용 — fixed LandingSectionTabs(48) + NavBar(64) 가림 회피.
  const handleNav = (item: NavMenuItem) => {
    setOpen(false);
    if (item.kind === "section") {
      if (location.pathname !== "/landing") { navigate(`/landing#${item.target}`); return; }
      scrollToLandingSection(item.target, { updateHash: false });
      return;
    }
    navigate(item.target);
  };

  // ESC 키로 패널 닫기 + body scroll lock
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = prev; document.removeEventListener("keydown", onKey); };
  }, [open]);

  return (
    <>
      <nav style={{ position: "sticky", top: 0, zIndex: 50, background: tokens.bg, backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", borderBottom: `1px solid ${tokens.border}`, padding: "0 20px" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", height: 60, gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-label="전체 메뉴 열기"
              data-testid="landing-nav-burger"
              className="landing-nav-burger"
              style={{
                width: 38, height: 38, borderRadius: 10,
                background: "transparent",
                border: `1px solid ${tokens.border}`,
                color: tokens.textPrimary, cursor: "pointer",
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                transition: "background 0.15s, border-color 0.15s",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = isDark ? "rgba(255,255,255,0.06)" : "rgba(15,23,42,0.04)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="3.5" y1="7" x2="20.5" y2="7" /><line x1="3.5" y1="12" x2="20.5" y2="12" /><line x1="3.5" y1="17" x2="20.5" y2="17" /></svg>
            </button>
            <Link to="/landing" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none", color: tokens.textPrimary }}>
              {logoUrl ? (
                <img src={logoUrl} alt={config.brand_name} style={{ height: 30, width: "auto", objectFit: "contain" }} />
              ) : brandMark}
              <span style={{ fontSize: 17, fontWeight: 700, letterSpacing: "-0.022em", whiteSpace: "nowrap" }}>{config.brand_name}</span>
            </Link>
          </div>
          {/* 가로 메뉴 — 데스크탑/태블릿에서만 노출(애플식 minimal top nav).
              모바일에선 햄버거 패널로 일임 (CSS .landing-nav-inline 미디어쿼리). */}
          <div className="landing-nav-inline" style={{ display: "none", alignItems: "center", gap: 2, flex: 1, justifyContent: "center", overflow: "hidden" }}>
            {inlineNav.map((it) => (
              <button
                key={it.key}
                type="button"
                onClick={() => handleNav(it.item)}
                data-testid={`landing-nav-top-${it.key}`}
                className="landing-nav-top-item"
                style={{
                  position: "relative",
                  padding: "8px 14px",
                  background: "transparent", border: "none",
                  color: tokens.textPrimary,
                  fontSize: 13.5, fontWeight: 500, letterSpacing: "-0.01em",
                  cursor: "pointer", borderRadius: 6,
                  transition: "color 0.16s ease",
                  whiteSpace: "nowrap",
                  ['--lh-accent' as never]: tokens.primaryColor,
                } as React.CSSProperties}
              >{it.label}</button>
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            <NavRoleAuthMenu cta={cta} ctaLink={ctaLink} tokens={tokens} />
          </div>
        </div>
        <style>{`
          /* 데스크탑/태블릿: 가로 nav 노출, 모바일: 햄버거 only.
             840px 이하는 inline nav가 잘릴 수 있어 햄버거로 일임. */
          @media (min-width: 840px) {
            .landing-nav-inline { display: flex !important; }
            .landing-nav-burger { display: flex !important; }
          }
          /* 가로 nav 메뉴 hover — Apple 톤 underline + subtle accent color */
          .landing-nav-top-item::after {
            content: "";
            position: absolute;
            left: 14px; right: 14px; bottom: 4px;
            height: 1.5px;
            background: var(--lh-accent, currentColor);
            transform: scaleX(0);
            transform-origin: center;
            transition: transform 0.22s cubic-bezier(.4,0,.2,1);
            border-radius: 1px;
          }
          .landing-nav-top-item:hover { color: var(--lh-accent, currentColor); }
          .landing-nav-top-item:hover::after { transform: scaleX(1); }
        `}</style>
      </nav>
      {open && (
        <NavSidePanel
          open={open}
          onClose={() => setOpen(false)}
          categories={categories}
          tokens={tokens}
          config={config}
          cta={cta}
          ctaLink={ctaLink}
          brandMark={brandMark}
          logoUrl={logoUrl}
          onNav={handleNav}
        />
      )}
    </>
  );
}

/** 사이드 슬라이드 패널 — 카테고리 그루핑 + premium typography + 학원장 시점 진입 동선.
 *
 * - 좌측 sticky drawer (모바일 full-width, 데스크탑 380px)
 * - 카테고리별 헤더(uppercase 작은 라벨) + 큰 메뉴 항목
 * - 푸터: role-aware CTA(로그인/내 콘솔)
 */
function NavSidePanel({ open, onClose, categories, tokens, config, cta, ctaLink, brandMark, logoUrl, onNav }: {
  open: boolean; onClose: () => void; categories: NavMenuCategory[]; tokens: NavBarTokens;
  config: LandingConfig; cta: string; ctaLink: string; brandMark: React.ReactNode; logoUrl: string | null;
  onNav: (item: NavMenuItem) => void;
}) {
  const isDark = tokens.bg.includes("10,14,26");
  const hoverBg = isDark ? "rgba(255,255,255,0.05)" : "rgba(15,23,42,0.04)";
  const accentSoft = `rgba(${tokens.primaryRgb}, 0.12)`;
  const dividerColor = isDark ? "rgba(255,255,255,0.06)" : "rgba(15,23,42,0.06)";

  // panel 직접 ESC 핸들러 — document keydown(LandingNavBar useEffect)에 더해 dialog 자체에서도 처리.
  // 2026-05-11 E2E: focus 위치에 따라 document handler 미발화 케이스 대응(defense in depth).
  const panelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    panelRef.current?.focus();
  }, []);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 100,
        background: "rgba(8,12,22,0.55)",
        backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)",
        animation: "landingPanelFade 0.18s ease-out",
      }}
    >
      <div
        ref={panelRef}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => { if (e.key === "Escape") { e.stopPropagation(); onClose(); } }}
        role="dialog"
        aria-modal="true"
        aria-label="전체 메뉴"
        tabIndex={-1}
        style={{
          position: "absolute", top: 0, left: 0, bottom: 0,
          width: "min(92vw, 380px)",
          background: tokens.panelBg,
          borderRight: `1px solid ${tokens.border}`,
          display: "flex", flexDirection: "column",
          boxShadow: "0 0 48px rgba(0,0,0,0.35)",
          outline: "none",
          animation: "landingPanelSlide 0.22s cubic-bezier(0.32, 0.72, 0.32, 1)",
        }}
      >
        {/* 헤더 — 로고 + 닫기 */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "18px 20px 16px", borderBottom: `1px solid ${dividerColor}`, flexShrink: 0,
        }}>
          <Link to="/landing" onClick={onClose} style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none", color: tokens.textPrimary }}>
            {logoUrl
              ? <img src={logoUrl} alt={config.brand_name} style={{ height: 30, width: "auto", objectFit: "contain" }} />
              : brandMark}
            <span style={{ fontSize: 16, fontWeight: 800, letterSpacing: "-0.02em" }}>{config.brand_name}</span>
          </Link>
          <button
            type="button"
            onClick={onClose}
            aria-label="메뉴 닫기"
            style={{
              width: 36, height: 36, borderRadius: 8,
              background: "transparent", border: `1px solid ${tokens.border}`,
              color: tokens.textPrimary, cursor: "pointer",
              display: "inline-flex", alignItems: "center", justifyContent: "center",
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" /></svg>
          </button>
        </div>

        {/* 카테고리 그룹 — overflow scroll + 스크롤바 시각 숨김(학원장 spec 2026-05-12) */}
        <div
          className="landing-nav-side-scroll"
          style={{
            flex: 1, overflowY: "auto",
            padding: "12px 12px 16px",
            scrollbarWidth: "none",                  // Firefox
            msOverflowStyle: "none" as "auto",       // IE/Edge legacy
          }}
        >
          {categories.length === 0 ? (
            <div style={{ padding: 24, color: tokens.textSecondary, fontSize: 14 }}>
              현재 노출 가능한 메뉴가 없습니다.
            </div>
          ) : categories.map((cat) => (
            <div key={cat.key} style={{ marginBottom: 8 }}>
              <div style={{
                padding: "16px 16px 8px",
                fontSize: 11, fontWeight: 700,
                color: tokens.primaryColor,
                letterSpacing: "0.1em", textTransform: "uppercase",
              }}>
                {cat.label}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {cat.items.map((it) => (
                  <button
                    key={it.key}
                    type="button"
                    onClick={() => onNav(it)}
                    data-testid={`landing-nav-item-${cat.key}-${it.key}`}
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
                      padding: "12px 16px",
                      background: "transparent",
                      border: "none", borderRadius: 10,
                      color: tokens.textPrimary,
                      fontSize: 15.5, fontWeight: 600, letterSpacing: "-0.01em",
                      cursor: "pointer", textAlign: "left",
                      transition: "background 0.12s, color 0.12s",
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = hoverBg; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                  >
                    <span>{it.label}</span>
                    {it.badge && (
                      <span style={{
                        padding: "2px 7px", borderRadius: 999,
                        fontSize: 10, fontWeight: 700, letterSpacing: "0.06em",
                        background: accentSoft, color: tokens.primaryColor,
                      }}>{it.badge}</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* 푸터 — CTA + role-aware 진입 */}
        <div style={{
          padding: "14px 16px 18px",
          borderTop: `1px solid ${dividerColor}`,
          background: isDark ? "rgba(0,0,0,0.18)" : "rgba(15,23,42,0.02)",
          flexShrink: 0,
        }}>
          <a
            href={ctaLink}
            onClick={onClose}
            style={{
              display: "block",
              padding: "13px 18px", borderRadius: 12,
              background: tokens.ctaGradient,
              color: tokens.ctaTextColor,
              fontSize: 15, fontWeight: 700, letterSpacing: "-0.01em",
              textDecoration: "none", textAlign: "center",
              boxShadow: `0 6px 20px rgba(${tokens.primaryRgb}, 0.25)`,
            }}
          >{cta}</a>
          <div style={{ marginTop: 10, display: "flex", justifyContent: "center" }}>
            <NavRoleAuthMenu cta={cta} ctaLink={ctaLink} tokens={tokens} variant="footer" />
          </div>
        </div>
      </div>
      <style>{`
        @keyframes landingPanelFade { from { opacity: 0 } to { opacity: 1 } }
        @keyframes landingPanelSlide { from { transform: translateX(-12px); opacity: 0.4 } to { transform: translateX(0); opacity: 1 } }
        /* WebKit (Chrome/Safari): 스크롤바 시각 숨김(스크롤 기능은 유지). 학원장 spec 2026-05-12. */
        .landing-nav-side-scroll::-webkit-scrollbar { width: 0; height: 0; display: none; }
        .landing-nav-side-scroll::-webkit-scrollbar-thumb { background: transparent; }
      `}</style>
    </div>
  );
}

/** 공통 nav 우측 — 비로그인=로그인+CTA / 로그인=역할별 마이페이지 진입.
 *
 * variant="header" (default) — nav bar 우측에 컴팩트. 비로그인 시 로그인만 노출(CTA는 햄버거 패널 푸터에).
 * variant="footer" — 사이드 패널 푸터에 큰 size. 비로그인은 로그인 강조, 로그인은 role별 콘솔.
 */
function NavRoleAuthMenu({ cta: _cta, ctaLink: _ctaLink, tokens, variant = "header" }: { cta: string; ctaLink: string; tokens: NavBarTokens; variant?: "header" | "footer" }) {
  const { user, isAuthenticated } = useAuth();
  const u = user as { tenantRole?: string | null; is_superuser?: boolean } | null;
  const role = (u?.tenantRole ?? "").toLowerCase();
  let myPath = "/admin";
  let roleLabel = "관리실";
  if (role === "student") { myPath = "/student"; roleLabel = "내 학생앱"; }
  else if (role === "parent") { myPath = "/student"; roleLabel = "학부모 페이지"; }
  else if (role === "teacher") { myPath = "/admin"; roleLabel = "강사 콘솔"; }
  else if (role === "assistant") { myPath = "/admin"; roleLabel = "조교 콘솔"; }

  const isFooter = variant === "footer";

  if (!isAuthenticated) {
    if (isFooter) {
      return (
        <Link to="/login" onClick={() => saveReturnPath()} style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          padding: "10px 18px", borderRadius: 999,
          fontSize: 13, fontWeight: 600,
          textDecoration: "none", color: tokens.textSecondary,
          border: `1px solid ${tokens.border}`,
        }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" /><polyline points="10,17 15,12 10,7" /><line x1="15" y1="12" x2="3" y2="12" /></svg>
          이미 회원이신가요? 로그인
        </Link>
      );
    }
    return (
      <Link to="/login" data-testid="landing-nav-login" onClick={() => saveReturnPath()} style={{
        padding: "8px 14px", borderRadius: 999, fontSize: 13, fontWeight: 600,
        textDecoration: "none", color: tokens.textPrimary,
        background: "transparent",
        border: `1px solid ${tokens.border}`,
        letterSpacing: "-0.01em",
      }}>로그인</Link>
    );
  }

  // 로그인 — role별 마이콘솔/마이앱
  return (
    <Link
      to={myPath}
      data-testid="landing-nav-myconsole"
      style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        padding: isFooter ? "11px 20px" : "8px 14px",
        background: isFooter ? tokens.ctaGradient : "rgba(255,255,255,0.06)",
        color: isFooter ? tokens.ctaTextColor : tokens.textPrimary,
        border: isFooter ? "none" : `1px solid ${tokens.border}`,
        borderRadius: 999,
        fontSize: isFooter ? 14 : 13,
        fontWeight: isFooter ? 700 : 600,
        textDecoration: "none", letterSpacing: "-0.01em",
        boxShadow: isFooter ? `0 6px 20px rgba(${tokens.primaryRgb}, 0.25)` : "none",
      }}
    >
      <svg width={isFooter ? 14 : 13} height={isFooter ? 14 : 13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg>
      {roleLabel}
    </Link>
  );
}

/** 상담 요청 form — contact 섹션 inline.
 *
 * 외부 학부모가 직접 이름/전화/관심강좌/메시지 제출 → backend POST /landing/consult/
 * 인증 X (공개 endpoint), tenant 격리 + rate limit + 검증.
 */
export function ConsultRequestForm({ accent, dark = false }: { accent: string; dark?: boolean }) {
  const [form, setForm] = useState({ name: "", phone: "", interest: "", message: "" });
  const [hp, setHp] = useState(""); // honeypot — 봇만 채움. 사람은 안 보임 (CSS hidden).
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pending || done) return;
    setErr(null);
    if (!form.name.trim() || !form.phone.trim()) {
      setErr("이름과 전화번호는 필수입니다.");
      return;
    }
    setPending(true);
    try {
      await api.post("/core/landing/consult/", { ...form, website: hp, source: "landing-contact" }, { skipAuth: true } as ApiRequestConfig);
      setDone(true);
    } catch (e) {
      const detail = (e as { response?: { data?: { detail?: string | string[] } } })?.response?.data?.detail;
      setErr(Array.isArray(detail) ? detail[0] : (typeof detail === "string" ? detail : "전송 실패. 잠시 후 다시 시도해주세요."));
    }
    setPending(false);
  };

  const fieldBg = dark ? "rgba(255,255,255,0.04)" : "#fff";
  const fieldBorder = dark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)";
  const labelColor = dark ? "#9CA3AF" : "#475569";
  const textColor = dark ? "#F5F1E8" : "#0f172a";

  if (done) {
    return (
      <div style={{
        padding: "32px 24px", borderRadius: 14, textAlign: "center",
        background: dark ? "rgba(212,160,76,0.08)" : "rgba(37,99,235,0.06)",
        border: `1px solid ${dark ? "rgba(212,160,76,0.25)" : "rgba(37,99,235,0.2)"}`,
        color: textColor,
      }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>✓</div>
        <p style={{ fontSize: 16, fontWeight: 700, margin: "0 0 6px" }}>상담 요청이 접수되었습니다</p>
        <p style={{ fontSize: 13, color: labelColor, margin: 0, lineHeight: 1.6 }}>학원에서 곧 연락드릴 예정입니다.</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} style={{ display: "grid", gap: 14 }}>
      {/* honeypot — display:none + autocomplete=off + tabindex=-1. 사람은 안 봄, 봇은 채움 */}
      <input
        type="text" name="website" value={hp} onChange={(e) => setHp(e.target.value)}
        tabIndex={-1} autoComplete="off" aria-hidden="true"
        style={{ position: "absolute", left: "-9999px", width: 1, height: 1, opacity: 0 }}
      />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <FormField label="이름" required dark={dark}>
          <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={50} disabled={pending} required
            style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: `1px solid ${fieldBorder}`, background: fieldBg, color: textColor, fontSize: 14, fontFamily: "inherit", outline: "none" }} />
        </FormField>
        <FormField label="전화번호" required dark={dark}>
          <input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} maxLength={20} placeholder="010-0000-0000" disabled={pending} required
            style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: `1px solid ${fieldBorder}`, background: fieldBg, color: textColor, fontSize: 14, fontFamily: "inherit", outline: "none" }} />
        </FormField>
      </div>
      <FormField label="관심 강좌·학년 (선택)" dark={dark}>
        <input type="text" value={form.interest} onChange={(e) => setForm({ ...form, interest: e.target.value })} maxLength={80} placeholder="예: 통합과학 / 고1" disabled={pending}
          style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: `1px solid ${fieldBorder}`, background: fieldBg, color: textColor, fontSize: 14, fontFamily: "inherit", outline: "none" }} />
      </FormField>
      <FormField label="궁금한 점 (선택)" dark={dark}>
        <textarea value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} maxLength={2000} rows={3} disabled={pending}
          style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: `1px solid ${fieldBorder}`, background: fieldBg, color: textColor, fontSize: 14, fontFamily: "inherit", outline: "none", resize: "vertical" }} />
      </FormField>
      {err && <div style={{ padding: "10px 12px", borderRadius: 8, background: "rgba(220,38,38,0.1)", border: "1px solid rgba(220,38,38,0.25)", color: dark ? "#fca5a5" : "#b91c1c", fontSize: 13, fontWeight: 500 }}>{err}</div>}
      <button type="submit" disabled={pending} style={{
        marginTop: 6, padding: "13px 22px", borderRadius: 10, border: "none",
        background: pending ? "#94a3b8" : accent, color: dark ? "#0A0E1A" : "#fff",
        fontSize: 15, fontWeight: 700, cursor: pending ? "wait" : "pointer",
        letterSpacing: "-0.01em",
      }}>
        {pending ? "전송 중..." : "상담 요청 보내기"}
      </button>
      <p style={{ fontSize: 11, color: labelColor, margin: 0, textAlign: "center", lineHeight: 1.5 }}>
        제출하신 정보는 상담 응대 목적으로만 사용되며 외부에 공개되지 않습니다.
      </p>
    </form>
  );
}

function FormField({ label, required, children, dark }: { label: string; required?: boolean; children: React.ReactNode; dark?: boolean }) {
  return (
    <label style={{ display: "block" }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: dark ? "#9CA3AF" : "#475569", marginBottom: 6, letterSpacing: "0.02em" }}>
        {label}{required && <span style={{ color: "#ef4444", marginLeft: 4 }}>*</span>}
      </div>
      {children}
    </label>
  );
}

/** 공개 testimonials fetch — 학원장 승인된 후기. 학원장이 LandingEditor에 직접 입력한 items와 합쳐서 노출. */
export interface PublicTestimonial { id: number; name: string; role: string; text: string }
export function usePublicTestimonials(): PublicTestimonial[] {
  const [list, setList] = useState<PublicTestimonial[]>([]);
  useEffect(() => {
    api.get("/core/landing/testimonial/public/", { skipAuth: true } as ApiRequestConfig)
      .then((r) => setList(Array.isArray(r?.data?.items) ? r.data.items : []))
      .catch(() => setList([]));
  }, []);
  return list;
}

/** 후기 남기기 form — testimonials 섹션 옆 또는 하단에. 제출 → pending → 학원장 승인 후 노출. */
export function TestimonialSubmitForm({ accent, dark = false }: { accent: string; dark?: boolean }) {
  const [form, setForm] = useState({ name: "", role: "", text: "" });
  const [hp, setHp] = useState("");
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pending || done) return;
    setErr(null);
    if (!form.name.trim()) { setErr("이름을 입력해주세요."); return; }
    if (form.text.trim().length < 10) { setErr("후기는 10자 이상 입력해주세요."); return; }
    setPending(true);
    try {
      await api.post("/core/landing/testimonial/", { ...form, website: hp }, { skipAuth: true } as ApiRequestConfig);
      setDone(true);
    } catch (e) {
      const detail = (e as { response?: { data?: { detail?: string | string[] } } })?.response?.data?.detail;
      setErr(Array.isArray(detail) ? detail[0] : (typeof detail === "string" ? detail : "전송 실패. 잠시 후 다시 시도해주세요."));
    }
    setPending(false);
  };

  const fieldBg = dark ? "rgba(255,255,255,0.04)" : "#fff";
  const fieldBorder = dark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)";
  const labelColor = dark ? "#9CA3AF" : "#475569";
  const textColor = dark ? "#F5F1E8" : "#0f172a";

  if (done) {
    return (
      <div style={{ padding: 18, borderRadius: 12, background: dark ? "rgba(212,160,76,0.08)" : "rgba(37,99,235,0.06)", border: `1px solid ${dark ? "rgba(212,160,76,0.25)" : "rgba(37,99,235,0.2)"}`, color: textColor, textAlign: "center" }}>
        <p style={{ fontSize: 14, fontWeight: 700, margin: "0 0 4px" }}>후기를 보내주셔서 감사합니다 ✓</p>
        <p style={{ fontSize: 12, color: labelColor, margin: 0 }}>학원장 검토 후 공개됩니다.</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} style={{ display: "grid", gap: 10 }}>
      <input type="text" name="website" value={hp} onChange={(e) => setHp(e.target.value)} tabIndex={-1} autoComplete="off" aria-hidden
        style={{ position: "absolute", left: "-9999px", width: 1, height: 1, opacity: 0 }} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <input type="text" placeholder="이름" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={50} disabled={pending} required
          style={{ padding: "10px 12px", borderRadius: 8, border: `1px solid ${fieldBorder}`, background: fieldBg, color: textColor, fontSize: 13, fontFamily: "inherit", outline: "none" }} />
        <input type="text" placeholder="학년·관계 (예: 고1 학부모)" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} maxLength={80} disabled={pending}
          style={{ padding: "10px 12px", borderRadius: 8, border: `1px solid ${fieldBorder}`, background: fieldBg, color: textColor, fontSize: 13, fontFamily: "inherit", outline: "none" }} />
      </div>
      <textarea placeholder="후기를 자유롭게 남겨주세요 (10자 이상)" value={form.text} onChange={(e) => setForm({ ...form, text: e.target.value })} maxLength={1000} rows={3} disabled={pending} required
        style={{ padding: "10px 12px", borderRadius: 8, border: `1px solid ${fieldBorder}`, background: fieldBg, color: textColor, fontSize: 13, fontFamily: "inherit", outline: "none", resize: "vertical" }} />
      {err && <div style={{ padding: "8px 12px", borderRadius: 8, background: "rgba(220,38,38,0.1)", border: "1px solid rgba(220,38,38,0.25)", color: dark ? "#fca5a5" : "#b91c1c", fontSize: 12, fontWeight: 500 }}>{err}</div>}
      <button type="submit" disabled={pending} style={{
        padding: "10px 20px", borderRadius: 8, border: "none",
        background: pending ? "#94a3b8" : accent, color: dark ? "#0A0E1A" : "#fff",
        fontSize: 13, fontWeight: 700, cursor: pending ? "wait" : "pointer",
      }}>
        {pending ? "전송 중…" : "후기 남기기"}
      </button>
    </form>
  );
}

/** 학원의 매치업 통산 KPI — 강사 프로필 카드 등에서 자동 노출.
 *
 * 데이터: 학원장이 picker에 박은 보고서들의 누적 적중률 + 보고서 수.
 * 학원장 입력 X — picker 변경 시 자동 갱신.
 *
 * Module-level cache: 같은 ids로 여러 컴포넌트가 호출해도 fetch 1회만 실행.
 */
export function useTenantHitStats(reportIds: number[]): { reportCount: number; avgHitRatePct: number } | null {
  const [stats, setStats] = useState<{ reportCount: number; avgHitRatePct: number } | null>(null);
  const idsKey = hitReportIdsKey(reportIds);

  useEffect(() => {
    const ids = idsKey ? idsKey.split(",").map((n) => Number(n)).filter((n) => Number.isFinite(n)) : [];
    if (!ids.length) {
      setStats({ reportCount: 0, avgHitRatePct: 0 });
      return;
    }
    fetchPublicHitReportsCached(ids)
      .then((reports) => {
        if (!reports.length) { setStats({ reportCount: 0, avgHitRatePct: 0 }); return; }
        const totalHit = reports.reduce((s, c) => s + (c.hit_count || 0), 0);
        const totalProb = reports.reduce((s, c) => s + (c.total_problems || 0), 0);
        const avg = totalProb > 0 ? Math.round((totalHit / totalProb) * 1000) / 10 : 0;
        setStats({ reportCount: reports.length, avgHitRatePct: avg });
      })
      .catch(() => setStats({ reportCount: 0, avgHitRatePct: 0 }));
  }, [idsKey]);

  return stats;
}

/** 공개 적중보고서 카드 — 학원장이 골라서 노출하는 마케팅 KPI 카드.
 *
 * - 데이터: GET /api/v1/matchup/landing/public/?ids=... (인증 X, subdomain → tenant 격리)
 * - 디자인: 카드 그리드. KPI 숫자(적중률 + 적중수/총수)만 강조. 본문/PDF/이미지는 노출 안 함.
 * - 학원장이 보고서를 게시 안 했거나 ID 비어있으면 카드 자체 안 그림.
 * - SSR fetch 실패해도 placeholder만 그리고 끝남(랜딩 깨지면 안 됨).
 */
/** 학원 운영진/강사 권한 체크 — 카드에 "수정" 액션 노출 결정.
 * - owner/admin: 학원장 (홈페이지 자체 + 보고서 둘 다 수정)
 * - teacher: 강사 (자기 보고서 수정)
 * - student/parent/외부 관전자: 액션 없음 (카드 보기만)
 */
function useStaffRole(): "owner_admin" | "teacher" | null {
  const { user, isAuthenticated } = useAuth();
  if (!isAuthenticated) return null;
  const u = user as { tenantRole?: string | null; is_superuser?: boolean } | null;
  if (u?.is_superuser) return "owner_admin";
  const role = (u?.tenantRole ?? "").toLowerCase();
  if (role === "owner" || role === "admin") return "owner_admin";
  if (role === "teacher") return "teacher";
  return null;
}

export function HitReportCards({ items, color, rgb, theme = "light" }: { items: HitReportShowcaseItem[]; color: string; rgb: string; theme?: "light" | "dark" }) {
  const [cards, setCards] = useState<HitReportPublicCard[] | null>(null);
  const [error, setError] = useState(false);
  const staffRole = useStaffRole();
  const canManage = staffRole !== null; // owner/admin/teacher 모두 카드에 액션 노출
  const navigate = useNavigate();

  const cardIdsKey = normalizeHitReportIds((items || []).map((it) => it.report_id)).join(",");
  useEffect(() => {
    const ids = cardIdsKey ? cardIdsKey.split(",").map((n) => Number(n)).filter((n) => Number.isFinite(n)) : [];
    if (!ids.length) {
      setCards([]);
      return;
    }
    // 캐시 활용 — 같은 ids 다른 컴포넌트(InstructorCard 등)와 fetch 공유.
    fetchPublicHitReportsCached(ids)
      .then((reports) => setCards(reports))
      .catch(() => setError(true));
  }, [cardIdsKey]);

  if (error || cards === null) {
    return <div style={{ minHeight: 160 }} />;
  }
  if (!cards.length) return null;

  const labelMap = new Map<number, string | undefined>(
    (items || []).map((it) => [it.report_id, it.display_label]),
  );

  const dark = theme === "dark";
  const cardBg = dark ? "rgba(255,255,255,0.03)" : "#fff";
  const cardBorder = dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)";
  const labelColor = dark ? "#9CA3AF" : "#94a3b8";
  const subColor = dark ? "#E5E7EB" : "#475569";
  const chipBg = `rgba(${rgb}, ${dark ? 0.1 : 0.06})`;
  const chipColor = dark ? "#F5F1E8" : "#475569";
  const cardShadow = dark ? "none" : "0 1px 3px rgba(0,0,0,0.04)";
  const manageChipBg = dark ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.04)";
  const manageChipColor = dark ? "#F5F1E8" : "#475569";

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20 }}>
      {cards.map((card) => (
        <HitReportCardItem
          key={card.id}
          card={card}
          labelOverride={labelMap.get(card.id)}
          color={color}
          rgb={rgb}
          dark={dark}
          cardBg={cardBg}
          cardBorder={cardBorder}
          cardShadow={cardShadow}
          labelColor={labelColor}
          subColor={subColor}
          chipBg={chipBg}
          chipColor={chipColor}
          canManage={canManage}
          manageChipBg={manageChipBg}
          manageChipColor={manageChipColor}
          onManage={() => navigate("/admin/storage/hit-reports")}
        />
      ))}
    </div>
  );
}

/** 단일 카드 컴포넌트 — hover 시 PDF 미리보기(첫 페이지 iframe) 노출. */
function HitReportCardItem({ card, labelOverride, color, rgb, dark, cardBg, cardBorder, cardShadow, labelColor, subColor, chipBg, chipColor, canManage, manageChipBg, manageChipColor, onManage }: {
  card: HitReportPublicCard; labelOverride?: string;
  color: string; rgb: string; dark: boolean;
  cardBg: string; cardBorder: string; cardShadow: string;
  labelColor: string; subColor: string; chipBg: string; chipColor: string;
  canManage: boolean; manageChipBg: string; manageChipColor: string; onManage: () => void;
}) {
  const [hover, setHover] = useState(false);
  const label = labelOverride || card.doc_category || card.doc_title;
  const sub = card.doc_title && card.doc_title !== label ? card.doc_title : "";
  const ratePct = Math.round(card.hit_rate_pct);

  // 박철T 학원장 호소(2026-05-13): "매치업 카드 마우스 가져다 댔을때 시각 깨짐현상".
  // 원인: hover 시 카드 우상단 우측옆에 PDF 1페이지 iframe thumbnail(280x360 흰 박스)이
  // translate(100%, 0)로 떠서 옆 카드를 덮음 — 다크 배경에 흰 큰 박스로 어색 + viewport
  // 끝 카드는 화면 밖. 카드 클릭 → /landing/reports/{id} detail 1클릭 진입이 이미 작동하므로
  // hover thumbnail은 제거. (이전: commit fa63d063 — 위치/크기 결함)

  return (
    <div
      style={{
        position: "relative",
        padding: 28,
        borderRadius: 18,
        background: cardBg,
        border: `1px solid ${hover ? (dark ? "rgba(212,160,76,0.45)" : "rgba(15,23,42,0.2)") : cardBorder}`,
        boxShadow: cardShadow,
        transition: "transform 0.2s ease, border-color 0.2s ease",
        transform: hover ? "translateY(-2px)" : "none",
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <Link
        to={`/landing/reports/${card.id}`}
        title="자세한 적중 보고서 보기"
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 14,
          textDecoration: "none",
          color: "inherit",
          cursor: "pointer",
        }}
      >
        <div style={{ fontSize: 11, fontWeight: 700, color: labelColor, letterSpacing: "0.06em", textTransform: "uppercase", paddingRight: canManage ? 60 : 0 }}>
          {label || "적중 보고서"}
        </div>
        {sub && (
          <div style={{ fontSize: 15, color: subColor, margin: 0, lineHeight: 1.5, fontWeight: 600, letterSpacing: "-0.015em" }}>
            {sub}
          </div>
        )}
        <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 4 }}>
          <span style={{ fontSize: 44, fontWeight: 800, color, lineHeight: 1, letterSpacing: "-0.03em" }}>
            {ratePct}
          </span>
          <span style={{ fontSize: 18, fontWeight: 700, color, opacity: 0.85 }}>%</span>
          <span style={{ fontSize: 12, color: labelColor, marginLeft: 6, letterSpacing: "0.04em", fontWeight: 600 }}>적중률</span>
        </div>
        <div
          style={{
            fontSize: 13, fontWeight: 600, color: chipColor,
            padding: "6px 12px", borderRadius: 999,
            background: chipBg,
            alignSelf: "flex-start",
            letterSpacing: "-0.01em",
          }}
        >
          {card.hit_count} <span style={{ opacity: 0.6 }}>/ {card.total_problems}</span> 문항
        </div>
        <div style={{ marginTop: 4, fontSize: 11, color: labelColor, fontWeight: 600, letterSpacing: "0.04em" }}>
          자세히 보기 →
        </div>
      </Link>
      {canManage && (
        <button
          type="button"
          onClick={onManage}
          style={{
            position: "absolute",
            top: 12,
            right: 12,
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            padding: "5px 10px",
            borderRadius: 999,
            background: manageChipBg,
            color: manageChipColor,
            fontSize: 11,
            fontWeight: 700,
            border: "none",
            cursor: "pointer",
            letterSpacing: "0.02em",
          }}
          title="이 보고서 관리실에서 수정"
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
          수정
        </button>
      )}
    </div>
  );
}
