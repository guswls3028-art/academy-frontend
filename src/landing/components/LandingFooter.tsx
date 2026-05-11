// PATH: src/landing/components/LandingFooter.tsx
// 모든 랜딩 페이지(PublicLandingPage / Reports* / 커뮤니티) 공통 푸터.
// nexon dnfm 스타일 메타 링크 그리드 + 학원 로고 + 저작권 + 최상단으로 버튼.
// tokens prop으로 dark/light 톤 분리(템플릿별/페이지별).
/* eslint-disable no-restricted-syntax */

import { Link, useNavigate, useLocation } from "react-router-dom";
import type { LandingConfig, LandingSection } from "../types";

export interface FooterTokens {
  bg: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  border: string;
  accent: string;
}

export const FOOTER_TOKENS_DARK: FooterTokens = {
  bg: "#080C16",
  textPrimary: "#F5F1E8",
  textSecondary: "#9CA3AF",
  textMuted: "#6B7280",
  border: "rgba(255,255,255,0.06)",
  accent: "#D4A04C",
};

export const FOOTER_TOKENS_LIGHT: FooterTokens = {
  bg: "#F8FAFC",
  textPrimary: "#0F172A",
  textSecondary: "#475569",
  textMuted: "#94A3B8",
  border: "rgba(15,23,42,0.08)",
  accent: "#2563EB",
};

interface MetaLink { key: string; label: string; kind: "section" | "route" | "anchor"; target: string }

/** 학원장 sections에서 자동 빌드되는 footer 메타 링크 4분할.
 *
 * - 학원 소개: instructor_profile, features, management_system, programs sections
 * - 매치업: hit_reports + 보고서 모두 보기 라우트
 * - 커뮤니티: 자유게시판/질문/공지/자료 (라우트 placeholder)
 * - 도움/문의: faq, contact, testimonials sections
 *
 * 학원장이 enable하지 않은 sections는 자동으로 footer에서도 빠짐.
 */
function buildFooterColumns(sections: LandingSection[]): { title: string; items: MetaLink[] }[] {
  const enabledTypes = new Set<string>(sections.filter((s) => s.enabled).map((s) => s.type));
  const has = (t: string) => enabledTypes.has(t);
  const cols: { title: string; items: MetaLink[] }[] = [];

  const about: MetaLink[] = [];
  if (has("instructor_profile")) about.push({ key: "instructor_profile", label: "강사 소개", kind: "section", target: "instructor_profile" });
  if (has("features")) about.push({ key: "features", label: "수업 특징", kind: "section", target: "features" });
  if (has("management_system")) about.push({ key: "management_system", label: "학생 관리", kind: "section", target: "management_system" });
  if (has("programs")) about.push({ key: "programs", label: "프로그램", kind: "section", target: "programs" });
  if (about.length) cols.push({ title: "학원 소개", items: about });

  const matchup: MetaLink[] = [];
  if (has("hit_reports")) {
    matchup.push({ key: "hit_reports", label: "적중 사례", kind: "section", target: "hit_reports" });
    matchup.push({ key: "reports", label: "보고서 모두 보기", kind: "route", target: "/landing/reports" });
  }
  if (matchup.length) cols.push({ title: "매치업", items: matchup });

  cols.push({
    title: "커뮤니티",
    items: [
      { key: "board", label: "자유게시판", kind: "route", target: "/landing/community/board" },
      { key: "qna", label: "질문게시판", kind: "route", target: "/landing/community/qna" },
      { key: "notice", label: "공지사항", kind: "route", target: "/landing/community/notice" },
    ],
  });

  const help: MetaLink[] = [];
  if (has("faq")) help.push({ key: "faq", label: "자주 묻는 질문", kind: "section", target: "faq" });
  if (has("contact")) help.push({ key: "contact", label: "상담 문의", kind: "section", target: "contact" });
  if (has("testimonials")) help.push({ key: "testimonials", label: "수강 후기", kind: "section", target: "testimonials" });
  if (help.length) cols.push({ title: "도움/문의", items: help });

  return cols;
}

export default function LandingFooter({ config, sections, tokens }: {
  config: LandingConfig;
  sections: LandingSection[];
  tokens: FooterTokens;
}) {
  const cols = buildFooterColumns(sections);
  const navigate = useNavigate();
  const location = useLocation();
  const year = new Date().getFullYear();

  const onMetaClick = (link: MetaLink) => {
    if (link.kind === "section") {
      if (location.pathname !== "/landing") { navigate(`/landing#${link.target}`); return; }
      const el = (Array.from(document.querySelectorAll("section[data-stype]")) as HTMLElement[])
        .find((s) => s.dataset.stype === link.target);
      if (el) window.scrollTo({ top: el.offsetTop - 70, behavior: "smooth" });
      return;
    }
    if (link.kind === "route") { navigate(link.target); return; }
    window.location.assign(link.target);
  };

  const scrollTop = () => window.scrollTo({ top: 0, behavior: "smooth" });

  return (
    <footer
      style={{
        background: tokens.bg,
        borderTop: `1px solid ${tokens.border}`,
        padding: "48px 24px 28px",
        color: tokens.textSecondary,
        fontFamily: "'Pretendard Variable', 'Pretendard', system-ui, sans-serif",
      }}
    >
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        {/* 상단 row: 브랜드 + 최상단으로 */}
        <div style={{
          display: "flex", alignItems: "flex-start", justifyContent: "space-between",
          gap: 24, flexWrap: "wrap", marginBottom: 28,
        }}>
          <div>
            <Link to="/landing" style={{ display: "inline-flex", alignItems: "center", gap: 10, textDecoration: "none", color: tokens.textPrimary }}>
              <BrandDot accent={tokens.accent} name={config.brand_name} logo={config.logo_url} />
              <span style={{ fontSize: 18, fontWeight: 800, letterSpacing: "-0.02em" }}>{config.brand_name}</span>
            </Link>
            {config.tagline && (
              <p style={{ marginTop: 8, fontSize: 13, color: tokens.textMuted, lineHeight: 1.6, maxWidth: 380 }}>
                {config.tagline}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={scrollTop}
            data-testid="landing-footer-scroll-top"
            aria-label="페이지 최상단으로"
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "8px 14px", borderRadius: 999,
              background: "transparent",
              border: `1px solid ${tokens.border}`,
              color: tokens.textSecondary, cursor: "pointer",
              fontSize: 12, fontWeight: 600, letterSpacing: "-0.01em",
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="12" y1="19" x2="12" y2="5" /><polyline points="5,12 12,5 19,12" /></svg>
            최상단으로
          </button>
        </div>

        {/* 컬럼 그리드 */}
        {cols.length > 0 && (
          <div style={{
            display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: 28, marginBottom: 36,
          }}>
            {cols.map((col) => (
              <div key={col.title}>
                <div style={{
                  fontSize: 11, fontWeight: 700, color: tokens.accent,
                  letterSpacing: "0.1em", textTransform: "uppercase",
                  marginBottom: 14,
                }}>{col.title}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {col.items.map((it) => (
                    <button
                      key={it.key}
                      type="button"
                      onClick={() => onMetaClick(it)}
                      style={{
                        background: "transparent", border: "none", padding: 0, textAlign: "left",
                        color: tokens.textSecondary, fontSize: 13.5, fontWeight: 500,
                        cursor: "pointer", letterSpacing: "-0.01em",
                        transition: "color 0.12s",
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = tokens.textPrimary; }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = tokens.textSecondary; }}
                    >{it.label}</button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 저작권 row */}
        <div style={{
          paddingTop: 20, borderTop: `1px solid ${tokens.border}`,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          gap: 12, flexWrap: "wrap",
        }}>
          <p style={{ margin: 0, fontSize: 12, color: tokens.textMuted, letterSpacing: "0.01em" }}>
            © {year} {config.brand_name}. All rights reserved.
          </p>
          <p style={{ margin: 0, fontSize: 11, color: tokens.textMuted, letterSpacing: "0.04em" }}>
            powered by 학원플러스
          </p>
        </div>
      </div>
    </footer>
  );
}

function BrandDot({ accent, name, logo }: { accent: string; name: string; logo?: string }) {
  if (logo) return <img src={logo} alt={name} style={{ height: 28, width: "auto", objectFit: "contain" }} />;
  const initial = (name || "").trim().charAt(0) || "•";
  return (
    <div style={{
      width: 28, height: 28, borderRadius: 7,
      background: `linear-gradient(135deg, ${accent} 0%, ${accent}99 100%)`,
      display: "flex", alignItems: "center", justifyContent: "center",
      color: "#0A0E1A", fontSize: 14, fontWeight: 800,
    }}>{initial}</div>
  );
}
