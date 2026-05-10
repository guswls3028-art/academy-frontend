// PATH: src/app_admin/domains/landing/templates/shared.tsx
// 공통 렌더링 유틸. 모든 템플릿에서 사용.
//
// 랜딩 템플릿 도메인 — inline style 면제 + 기존 시그니처 호환 (color/borderColor 등 일부 unused 파라미터).
/* eslint-disable no-restricted-syntax, @typescript-eslint/no-unused-vars, react-refresh/only-export-components, react-hooks/exhaustive-deps */

import type { LandingConfig, LandingSection, FeatureItem, TestimonialItem, ProgramItem, FaqItem, HitReportShowcaseItem, HitReportPublicCard } from "../types";
import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import useAuth from "@/auth/hooks/useAuth";
import api, { type ApiRequestConfig } from "@/shared/api/axios";
import { resolveTenantCode, getTenantIdFromCode, getTenantBranding } from "@/shared/tenant";

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

/** 로고 URL 결정 — 학원장 업로드 우선, 없으면 테넌트 브랜딩(로그인 화면 등에서 쓰는 기본 로고) fallback. */
export function useResolvedLogo(config: LandingConfig): string | null {
  if (config.logo_url) return config.logo_url;
  const tc = resolveTenantCode();
  if (!tc.ok) return null;
  const tid = getTenantIdFromCode(tc.code);
  if (!tid) return null;
  const branding = getTenantBranding(tid);
  return branding?.logoUrl || branding?.headerLogoUrl || null;
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

/** 공통 NavBar — light/dark 톤만 prop으로 받음. PremiumDark/MinimalTutor 모두 사용.
 *
 * 데스크탑: 로고 + 가로 메뉴 5개 + 역할 메뉴 + 골드/컬러 CTA
 * 모바일: 로고 + 햄버거 → 슬라이드 패널
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

export function LandingNavBar({ config, sections, tokens, brandMark, mobileBreakpoint = 900 }: { config: LandingConfig; sections: LandingSection[]; tokens: NavBarTokens; brandMark: React.ReactNode; mobileBreakpoint?: number }) {
  const [open, setOpen] = useState(false);
  const enabled = sections.filter((s) => s.enabled && NAV_SECTION_ANCHORS[s.type]);
  const cta = config.cta_text || "수강 문의";
  const ctaLink = config.cta_link || "/login";
  const logoUrl = useResolvedLogo(config);
  const navClass = `landing-nav-${tokens.bg.includes("10,14,26") ? "dark" : "light"}`;

  const scrollTo = (sectionType: string) => {
    setOpen(false);
    const all = Array.from(document.querySelectorAll("section[data-stype]")) as HTMLElement[];
    const el = all.find((s) => s.dataset.stype === sectionType);
    if (el) window.scrollTo({ top: el.offsetTop - 70, behavior: "smooth" });
  };

  return (
    <>
      <nav style={{ position: "sticky", top: 0, zIndex: 50, background: tokens.bg, backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", borderBottom: `1px solid ${tokens.border}`, padding: "0 24px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", height: 72, gap: 16 }}>
          <Link to="/landing" style={{ display: "flex", alignItems: "center", gap: 12, textDecoration: "none", color: tokens.textPrimary, flexShrink: 0 }}>
            {logoUrl ? (
              <img src={logoUrl} alt={config.brand_name} style={{ height: 38, width: "auto", objectFit: "contain" }} />
            ) : brandMark}
            <span style={{ fontSize: 18, fontWeight: 800, letterSpacing: "-0.02em", whiteSpace: "nowrap" }}>{config.brand_name}</span>
          </Link>
          <div className={`${navClass}-desk`} style={{ display: "flex", alignItems: "center", gap: 4, flex: 1, justifyContent: "center", overflow: "hidden" }}>
            {enabled.slice(0, 5).map((s) => (
              <button key={s.type} type="button" onClick={() => scrollTo(s.type)} style={{
                padding: "8px 14px", borderRadius: 8, background: "transparent", border: "none",
                color: tokens.textSecondary, fontSize: 14, fontWeight: 600, cursor: "pointer",
                letterSpacing: "-0.01em", whiteSpace: "nowrap",
              }}
                onMouseEnter={(e) => { e.currentTarget.style.color = tokens.textPrimary; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = tokens.textSecondary; }}
              >{NAV_SECTION_ANCHORS[s.type]}</button>
            ))}
          </div>
          <div className={`${navClass}-cta`} style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
            <NavRoleAuthMenu cta={cta} ctaLink={ctaLink} tokens={tokens} />
          </div>
          <button type="button" className={`${navClass}-burger`} onClick={() => setOpen(true)} aria-label="메뉴 열기" style={{
            display: "none", width: 40, height: 40, borderRadius: 8,
            background: "transparent", border: `1px solid ${tokens.border}`, color: tokens.textPrimary, cursor: "pointer",
            alignItems: "center", justifyContent: "center",
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M3 12h18M3 18h18" /></svg>
          </button>
        </div>
      </nav>
      {open && (
        <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(15,23,42,0.45)", backdropFilter: "blur(8px)" }}>
          <div onClick={(e) => e.stopPropagation()} style={{
            position: "absolute", top: 0, right: 0, bottom: 0, width: "min(85vw, 320px)",
            background: tokens.panelBg, borderLeft: `1px solid ${tokens.border}`,
            display: "flex", flexDirection: "column", padding: 24,
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: tokens.textPrimary }}>{config.brand_name}</span>
              <button onClick={() => setOpen(false)} style={{ width: 36, height: 36, borderRadius: 8, background: "transparent", border: "none", color: tokens.textPrimary, fontSize: 22, cursor: "pointer" }}>×</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1 }}>
              {enabled.map((s) => (
                <button key={s.type} type="button" onClick={() => scrollTo(s.type)} style={{
                  padding: "13px 12px", borderRadius: 10, background: "transparent", border: "none",
                  color: tokens.textPrimary, fontSize: 16, fontWeight: 600, cursor: "pointer", textAlign: "left",
                }}>{NAV_SECTION_ANCHORS[s.type]}</button>
              ))}
            </div>
            <a href={ctaLink} style={{
              marginTop: 12, padding: "13px 18px", background: tokens.ctaGradient,
              color: tokens.ctaTextColor, borderRadius: 10, fontSize: 15, fontWeight: 700,
              textDecoration: "none", textAlign: "center",
            }}>{cta}</a>
          </div>
        </div>
      )}
      <style>{`
        @media (max-width: ${mobileBreakpoint}px) {
          .${navClass}-desk { display: none !important; }
          .${navClass}-cta { display: none !important; }
          .${navClass}-burger { display: inline-flex !important; }
        }
      `}</style>
    </>
  );
}

/** 공통 nav 우측 — 비로그인=로그인+CTA / 로그인=역할별 마이페이지 진입 */
function NavRoleAuthMenu({ cta, ctaLink, tokens }: { cta: string; ctaLink: string; tokens: NavBarTokens }) {
  const { user, isAuthenticated } = useAuth();
  const u = user as { tenantRole?: string | null; is_superuser?: boolean } | null;
  const role = (u?.tenantRole ?? "").toLowerCase();
  let myPath = "/admin";
  let roleLabel = "관리실";
  if (role === "student") { myPath = "/student"; roleLabel = "학생 마이페이지"; }
  else if (role === "parent") { myPath = "/student"; roleLabel = "학부모 페이지"; }
  else if (role === "teacher") { myPath = "/admin"; roleLabel = "강사 콘솔"; }
  else if (role === "assistant") { myPath = "/admin"; roleLabel = "조교 콘솔"; }

  if (!isAuthenticated) {
    return (
      <>
        <Link to="/login" style={{
          padding: "9px 16px", borderRadius: 8, fontSize: 14, fontWeight: 600,
          textDecoration: "none", color: tokens.textSecondary,
          border: `1px solid ${tokens.border}`,
        }}>로그인</Link>
        <a href={ctaLink} style={{
          display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 18px",
          background: tokens.ctaGradient, color: tokens.ctaTextColor, borderRadius: 8,
          fontSize: 14, fontWeight: 700, textDecoration: "none",
          boxShadow: `0 4px 16px rgba(${tokens.primaryRgb}, 0.25)`,
        }}>
          {cta}
          <span style={{ fontSize: 14, lineHeight: 1, marginTop: -1 }}>›</span>
        </a>
      </>
    );
  }
  return (
    <Link to={myPath} style={{
      display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 16px",
      background: "rgba(255,255,255,0.06)", color: tokens.textPrimary,
      border: `1px solid ${tokens.border}`, borderRadius: 8,
      fontSize: 14, fontWeight: 600, textDecoration: "none", letterSpacing: "-0.01em",
    }}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg>
      {roleLabel}
    </Link>
  );
}

/** 학원의 매치업 통산 KPI — 강사 프로필 카드 등에서 자동 노출.
 *
 * 데이터: 학원장이 picker에 박은 보고서들의 누적 적중률 + 보고서 수.
 * 학원장 입력 X — picker 변경 시 자동 갱신.
 *
 * Module-level cache: 같은 ids로 여러 컴포넌트가 호출해도 fetch 1회만 실행
 * (HitReportCards + InstructorCard가 동일 ids 공유하는 케이스 최적화).
 */
const _hitReportsCache = new Map<string, HitReportPublicCard[]>();
const _hitReportsInflight = new Map<string, Promise<HitReportPublicCard[]>>();

function fetchHitReportsCached(ids: number[]): Promise<HitReportPublicCard[]> {
  const key = ids.slice().sort((a, b) => a - b).join(",");
  if (_hitReportsCache.has(key)) return Promise.resolve(_hitReportsCache.get(key)!);
  if (_hitReportsInflight.has(key)) return _hitReportsInflight.get(key)!;
  const p = api.get("/matchup/landing/public/", { params: { ids: key }, skipAuth: true } as ApiRequestConfig)
    .then((r) => {
      const reports = Array.isArray(r?.data?.reports) ? r.data.reports as HitReportPublicCard[] : [];
      _hitReportsCache.set(key, reports);
      _hitReportsInflight.delete(key);
      return reports;
    })
    .catch((e) => {
      _hitReportsInflight.delete(key);
      throw e;
    });
  _hitReportsInflight.set(key, p);
  return p;
}

export function useTenantHitStats(reportIds: number[]): { reportCount: number; avgHitRatePct: number } | null {
  const [stats, setStats] = useState<{ reportCount: number; avgHitRatePct: number } | null>(null);
  const idsKey = reportIds.slice().sort((a, b) => a - b).join(",");

  useEffect(() => {
    const ids = (reportIds || []).filter((n) => Number.isFinite(n));
    if (!ids.length) {
      setStats({ reportCount: 0, avgHitRatePct: 0 });
      return;
    }
    fetchHitReportsCached(ids)
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

  const cardIdsKey = (items || []).map((it) => it.report_id).filter((n) => Number.isFinite(n)).slice().sort((a, b) => a - b).join(",");
  useEffect(() => {
    const ids = (items || []).map((it) => it.report_id).filter((n) => Number.isFinite(n));
    if (!ids.length) {
      setCards([]);
      return;
    }
    // 캐시 활용 — 같은 ids 다른 컴포넌트(InstructorCard 등)와 fetch 공유.
    fetchHitReportsCached(ids)
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
      {cards.map((card) => {
        const label = labelMap.get(card.id) || card.doc_category || card.doc_title;
        const sub = card.doc_title && card.doc_title !== label ? card.doc_title : "";
        const ratePct = Math.round(card.hit_rate_pct);
        return (
          // 카드 = wrapper. Link(상세 페이지) + button(수정)을 sibling으로 두어
          // nested interactive 회피 + 키보드 접근성 보장.
          <div
            key={card.id}
            style={{
              position: "relative",
              padding: 28,
              borderRadius: 18,
              background: cardBg,
              border: `1px solid ${cardBorder}`,
              boxShadow: cardShadow,
              transition: "transform 0.2s ease, border-color 0.2s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-2px)";
              e.currentTarget.style.borderColor = dark ? "rgba(212,160,76,0.45)" : "rgba(15,23,42,0.2)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "none";
              e.currentTarget.style.borderColor = cardBorder;
            }}
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
                onClick={() => navigate("/admin/storage/hit-reports")}
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
      })}
    </div>
  );
}
