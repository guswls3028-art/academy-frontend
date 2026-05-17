// PATH: src/landing/pages/LandingGuidePage.tsx
// 가이드 dedicated page (task #10, Phase #73, 2026-05-13).
//
// 학원장 spec (박철T 2026-05-13): "헤더 메뉴 별로 라우트 구조".
// 사이드바/inline nav "가이드" 클릭 → 메인 페이지 #faq 스크롤이 아니라 이 페이지로 진입.
//
// 본문: 학원장이 LandingEditor에서 enable한 faq section을 그대로 렌더. faq section
// 비활성 시 placeholder. 추후 다른 guide section(설명 자료 등) 추가 가능.
/* eslint-disable no-restricted-syntax */

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchLandingPublic } from "../api";
import type { FaqItem, LandingPublicResponse } from "../types";
import { LandingNavBar, FaqAccordion, type NavBarTokens } from "../templates/shared";
import LandingFooter, { FOOTER_TOKENS_DARK, FOOTER_TOKENS_LIGHT } from "../components/LandingFooter";
import LandingRoleFab from "../components/LandingRoleFab";
import { setLandingMeta as setMeta } from "../utils/seoMeta";

function BrandMark({ name, color }: { name: string; color: string }) {
  const initial = (name || "").trim().charAt(0) || "•";
  return (
    <div style={{ width: 36, height: 36, borderRadius: 9, background: `linear-gradient(135deg, ${color} 0%, ${color}AA 100%)`, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 18, fontWeight: 800 }}>{initial}</div>
  );
}

export default function LandingGuidePage() {
  const [state, setState] = useState<{ loading: boolean; data: LandingPublicResponse | null }>({ loading: true, data: null });

  useEffect(() => {
    let cancelled = false;
    fetchLandingPublic()
      .then((d) => { if (!cancelled) setState({ loading: false, data: d }); })
      .catch(() => { if (!cancelled) setState({ loading: false, data: null }); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (state.data?.config) {
      const brand = state.data.config.brand_name;
      document.title = `가이드 — ${brand}`;
      setMeta("og:title", `${brand} 가이드`);
      setMeta("description", `${brand} 자주 묻는 질문 / 안내`);
    }
  }, [state.data]);

  if (state.loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: "#64748b", fontSize: 13 }}>불러오는 중…</div>
      </div>
    );
  }
  if (!state.data?.config) {
    return (
      <div style={{ minHeight: "100vh", background: "#fff", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, padding: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>학원 정보를 불러올 수 없습니다</h1>
        <Link to="/landing" style={{ color: "#2563eb", textDecoration: "none", fontSize: 13 }}>← 홈으로</Link>
      </div>
    );
  }

  const cfg = state.data.config;
  const sections = (cfg.sections || []).filter((s) => s.enabled);
  const faqSection = sections.find((s) => s.type === "faq");
  const faqItems = (faqSection?.items as FaqItem[] | undefined) || [];
  const primary = cfg.primary_color || "#1E3A5F";

  // 다크 템플릿 (premium_dark) 여부 — config.template_key 기반.
  const tplKey = (cfg as LandingPublicResponse["config"] & { template_key?: string }).template_key || "minimal_tutor";
  const isDark = tplKey === "premium_dark";

  const navTokens: NavBarTokens = isDark
    ? {
        bg: "rgba(10,14,26,0.85)", border: "rgba(255,255,255,0.08)",
        textPrimary: "#F5F1E8", textSecondary: "#9CA3AF",
        primaryColor: primary, primaryRgb: hexToRgb(primary),
        ctaGradient: `linear-gradient(135deg, ${primary} 0%, ${primary}CC 100%)`,
        ctaTextColor: "#0A0E1A", panelBg: "#0F1525",
      }
    : {
        bg: "rgba(255,255,255,0.92)", border: "rgba(15,23,42,0.08)",
        textPrimary: "#0f172a", textSecondary: "#475569",
        primaryColor: primary, primaryRgb: hexToRgb(primary),
        ctaGradient: `linear-gradient(135deg, ${primary} 0%, ${primary}CC 100%)`,
        ctaTextColor: "#fff", panelBg: "#fff",
      };

  const bg = isDark ? "#0A0E1A" : "#fff";
  const textPrimary = isDark ? "#F5F1E8" : "#0f172a";
  const textSecondary = isDark ? "#9CA3AF" : "#64748b";

  return (
    <div style={{ minHeight: "100vh", background: bg, color: textPrimary, fontFamily: "'Pretendard Variable', 'Pretendard', system-ui, sans-serif", letterSpacing: "-0.011em" }}>
      <LandingNavBar config={cfg} sections={cfg.sections || []} tokens={navTokens} brandMark={<BrandMark name={cfg.brand_name} color={primary} />} />

      {/* 페이지 헤더 */}
      <div style={{ borderBottom: `1px solid ${isDark ? "rgba(255,255,255,0.06)" : "rgba(15,23,42,0.06)"}` }}>
        <div style={{ maxWidth: 960, margin: "0 auto", padding: "56px 24px 36px" }}>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: primary, marginBottom: 10 }}>Guide</div>
          <h1 style={{ fontSize: 32, fontWeight: 800, margin: 0, letterSpacing: "-0.025em" }}>가이드</h1>
          <p style={{ fontSize: 14, color: textSecondary, margin: "10px 0 0", lineHeight: 1.7, maxWidth: 640 }}>
            {cfg.brand_name}에 대해 자주 묻는 질문을 모았습니다. 더 궁금한 점은 우측 상담 문의로 알려주세요.
          </p>
        </div>
      </div>

      {/* FAQ section */}
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "32px 24px 64px" }}>
        {faqItems.length === 0 ? (
          <div style={{
            padding: 48, textAlign: "center",
            background: isDark ? "rgba(255,255,255,0.03)" : "#f8fafc",
            border: `1px dashed ${isDark ? "rgba(255,255,255,0.1)" : "rgba(15,23,42,0.1)"}`,
            borderRadius: 16,
          }}>
            <div style={{ fontSize: 32, marginBottom: 10 }}>🌱</div>
            <p style={{ fontSize: 15, fontWeight: 700, margin: "0 0 8px" }}>아직 등록된 질문이 없습니다</p>
            <p style={{ fontSize: 13, color: textSecondary, margin: "0 0 16px", lineHeight: 1.6 }}>
              학원이 자주 듣는 질문을 등록 중입니다.<br />
              궁금한 점은 상담 문의로 직접 물어보실 수 있습니다.
            </p>
            <Link to="/landing#contact" style={{ display: "inline-block", padding: "9px 18px", borderRadius: 999, background: primary, color: isDark ? "#0A0E1A" : "#fff", textDecoration: "none", fontSize: 13, fontWeight: 700 }}>
              상담 문의 →
            </Link>
          </div>
        ) : (
          <>
            {(faqSection?.title || faqSection?.description) && (
              <div style={{ marginBottom: 24 }}>
                {faqSection?.title && (
                  <h2 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 8px", letterSpacing: "-0.02em" }}>{faqSection.title}</h2>
                )}
                {faqSection?.description && (
                  <p style={{ fontSize: 13.5, color: textSecondary, margin: 0, lineHeight: 1.7 }}>{faqSection.description}</p>
                )}
              </div>
            )}
            <FaqAccordion items={faqItems} color={primary} />
          </>
        )}

        {/* 추가 안내 — 상담/매치업 진입 */}
        <div style={{ marginTop: 48, padding: 24, borderRadius: 16, background: isDark ? "rgba(255,255,255,0.03)" : "#f8fafc", border: `1px solid ${isDark ? "rgba(255,255,255,0.06)" : "rgba(15,23,42,0.06)"}` }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 10px" }}>더 자세히 알아보기</h3>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            <Link to="/landing/about" style={pillStyle(primary, isDark)}>학원 소개 →</Link>
            <Link to="/landing/reports" style={pillStyle(primary, isDark)}>적중 보고서 →</Link>
            <Link to="/landing#contact" style={pillStyle(primary, isDark)}>상담 문의 →</Link>
          </div>
        </div>
      </div>

      <LandingFooter config={cfg} sections={cfg.sections || []} tokens={isDark ? FOOTER_TOKENS_DARK : FOOTER_TOKENS_LIGHT} />
      <LandingRoleFab />
    </div>
  );
}

function pillStyle(color: string, dark: boolean): React.CSSProperties {
  return {
    display: "inline-flex", alignItems: "center", gap: 4,
    padding: "8px 14px", borderRadius: 999,
    background: dark ? "rgba(255,255,255,0.06)" : "rgba(15,23,42,0.05)",
    color: dark ? "#F5F1E8" : color,
    border: `1px solid ${dark ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.08)"}`,
    textDecoration: "none", fontSize: 12.5, fontWeight: 700, letterSpacing: "-0.01em",
  };
}

function hexToRgb(hex: string): string {
  const h = hex.replace("#", "");
  if (h.length !== 6) return "30,58,95";
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `${r},${g},${b}`;
}
