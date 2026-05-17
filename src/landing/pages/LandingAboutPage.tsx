// PATH: src/landing/pages/LandingAboutPage.tsx
// 학원 소개 dedicated page (task #10, Phase #73, 2026-05-13).
//
// 학원장 spec (박철T 2026-05-13): "헤더 메뉴 별로 라우트 구조".
// 사이드바/inline nav "학원소개" 클릭 → 메인 페이지 #instructor_profile 스크롤이 아니라
// 이 페이지로 진입. 메인 페이지 sections 는 "요약본 진입 게이트" 로 그대로 유지.
//
// 본문: 학원장이 LandingEditor에서 enable 한 학원소개 카테고리 sections (instructor_profile
// / features / management_system / process_timeline / programs)를 페이지에 풀로 노출.
// 각 section은 자체 inline layout으로 그림 (메인 template 의존 X — 가벼운 통일 디자인).
/* eslint-disable no-restricted-syntax */

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchLandingPublic } from "../api";
import type {
  FeatureItem,
  InstructorProfileItem,
  LandingPublicResponse,
  LandingSection,
  ManagementCardItem,
  ProcessStepItem,
  ProgramItem,
} from "../types";
import { LandingNavBar, SvgIcon, type NavBarTokens } from "../templates/shared";
import LandingFooter, { FOOTER_TOKENS_DARK, FOOTER_TOKENS_LIGHT } from "../components/LandingFooter";
import LandingRoleFab from "../components/LandingRoleFab";
import { setLandingMeta as setMeta } from "../utils/seoMeta";

function BrandMark({ name, color }: { name: string; color: string }) {
  const initial = (name || "").trim().charAt(0) || "•";
  return (
    <div style={{ width: 36, height: 36, borderRadius: 9, background: `linear-gradient(135deg, ${color} 0%, ${color}AA 100%)`, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 18, fontWeight: 800 }}>{initial}</div>
  );
}

export default function LandingAboutPage() {
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
      document.title = `학원 소개 — ${brand}`;
      setMeta("og:title", `${brand} 학원 소개`);
      setMeta("description", `${brand}이(가) 어떤 학원인지 한눈에. 강사 프로필 / 수업 특징 / 학생 관리 / 수업 흐름 / 프로그램.`);
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
  const sections = (cfg.sections || []).filter((s) => s.enabled).sort((a, b) => a.order - b.order);
  const primary = cfg.primary_color || "#1E3A5F";
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
  const cardBg = isDark ? "rgba(255,255,255,0.03)" : "#f8fafc";
  const cardBorder = isDark ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.08)";

  // 학원소개 카테고리에 속하는 section 만 추출 (sidebar buildMenuCategories 와 정합)
  const aboutTypes = new Set(["instructor_profile", "features", "management_system", "process_timeline", "programs"]);
  const aboutSections = sections.filter((s) => aboutTypes.has(s.type));

  return (
    <div style={{ minHeight: "100vh", background: bg, color: textPrimary, fontFamily: "'Pretendard Variable', 'Pretendard', system-ui, sans-serif", letterSpacing: "-0.011em" }}>
      <LandingNavBar config={cfg} sections={cfg.sections || []} tokens={navTokens} brandMark={<BrandMark name={cfg.brand_name} color={primary} />} />

      {/* 페이지 헤더 */}
      <div style={{ borderBottom: `1px solid ${isDark ? "rgba(255,255,255,0.06)" : "rgba(15,23,42,0.06)"}` }}>
        <div style={{ maxWidth: 1080, margin: "0 auto", padding: "56px 24px 36px" }}>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: primary, marginBottom: 10 }}>About</div>
          <h1 style={{ fontSize: 32, fontWeight: 800, margin: 0, letterSpacing: "-0.025em" }}>{cfg.brand_name} 소개</h1>
          <p style={{ fontSize: 14, color: textSecondary, margin: "10px 0 0", lineHeight: 1.7, maxWidth: 720 }}>
            {cfg.tagline || "어떤 학원인지 한눈에 살펴보세요."}
            {cfg.subtitle && <><br />{cfg.subtitle}</>}
          </p>
        </div>
      </div>

      {/* sections */}
      <div style={{ maxWidth: 1080, margin: "0 auto", padding: "16px 24px 64px" }}>
        {aboutSections.length === 0 ? (
          <div style={{
            marginTop: 32, padding: 48, textAlign: "center",
            background: cardBg, border: `1px dashed ${cardBorder}`, borderRadius: 16,
          }}>
            <div style={{ fontSize: 32, marginBottom: 10 }}>📚</div>
            <p style={{ fontSize: 15, fontWeight: 700, margin: "0 0 8px" }}>학원 소개 콘텐츠 준비 중입니다</p>
            <p style={{ fontSize: 13, color: textSecondary, margin: "0 0 16px", lineHeight: 1.6 }}>
              학원이 곧 강사 프로필 / 수업 특징 / 학생 관리 / 프로그램 정보를 채울 예정입니다.<br />
              궁금한 점은 상담 문의로 직접 물어보실 수 있습니다.
            </p>
            <Link to="/landing#contact" style={{ display: "inline-block", padding: "9px 18px", borderRadius: 999, background: primary, color: isDark ? "#0A0E1A" : "#fff", textDecoration: "none", fontSize: 13, fontWeight: 700 }}>
              상담 문의 →
            </Link>
          </div>
        ) : (
          aboutSections.map((sec) => (
            <SectionBlock
              key={sec.type}
              section={sec}
              primary={primary}
              isDark={isDark}
              textPrimary={textPrimary}
              textSecondary={textSecondary}
              cardBg={cardBg}
              cardBorder={cardBorder}
            />
          ))
        )}

        {/* 진입 게이트 — 다른 카테고리로 */}
        <div style={{ marginTop: 64, padding: 24, borderRadius: 16, background: cardBg, border: `1px solid ${cardBorder}` }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 10px" }}>더 알아보기</h3>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            <Link to="/landing/reports" style={pillStyle(primary, isDark)}>적중 보고서 →</Link>
            <Link to="/landing/guide" style={pillStyle(primary, isDark)}>가이드 →</Link>
            <Link to="/landing/reviews" style={pillStyle(primary, isDark)}>수강 후기 →</Link>
            <Link to="/landing#contact" style={pillStyle(primary, isDark)}>상담 문의 →</Link>
          </div>
        </div>
      </div>

      <LandingFooter config={cfg} sections={cfg.sections || []} tokens={isDark ? FOOTER_TOKENS_DARK : FOOTER_TOKENS_LIGHT} />
      <LandingRoleFab />
    </div>
  );
}

function SectionBlock({
  section, primary, isDark, textPrimary, textSecondary, cardBg, cardBorder,
}: {
  section: LandingSection;
  primary: string;
  isDark: boolean;
  textPrimary: string;
  textSecondary: string;
  cardBg: string;
  cardBorder: string;
}) {
  const items = section.items || [];
  if (items.length === 0 && !section.description) return null;

  const titleMap: Record<string, string> = {
    instructor_profile: "강사 프로필",
    features: "수업 특징",
    management_system: "학생 관리",
    process_timeline: "수업 흐름",
    programs: "프로그램",
  };
  const title = section.title || titleMap[section.type] || section.type;

  return (
    <section style={{ marginTop: 48 }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: primary, marginBottom: 6 }}>
          {section.type.replace(/_/g, " ")}
        </div>
        <h2 style={{ fontSize: 24, fontWeight: 800, margin: 0, letterSpacing: "-0.02em", color: textPrimary }}>{title}</h2>
        {section.description && (
          <p style={{ fontSize: 14, color: textSecondary, margin: "8px 0 0", lineHeight: 1.7 }}>{section.description}</p>
        )}
      </div>

      {section.type === "instructor_profile" && (
        <div style={{ display: "grid", gap: 16 }}>
          {(items as InstructorProfileItem[]).map((it, i) => (
            <div key={i} style={{ padding: 24, borderRadius: 16, background: cardBg, border: `1px solid ${cardBorder}`, display: "grid", gridTemplateColumns: "120px 1fr", gap: 20, alignItems: "start" }}>
              {it.photo_url ? (
                <img src={it.photo_url} alt={it.name} style={{ width: 120, height: 150, borderRadius: 12, objectFit: "cover", border: `1px solid ${cardBorder}` }} />
              ) : (
                <div style={{ width: 120, height: 150, borderRadius: 12, background: `linear-gradient(135deg, ${primary}30 0%, ${primary}10 100%)`, display: "flex", alignItems: "center", justifyContent: "center", color: primary, fontSize: 48, fontWeight: 800, border: `1px solid ${cardBorder}` }}>
                  {(it.name || "").trim().charAt(0) || "•"}
                </div>
              )}
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: primary, marginBottom: 6 }}>{it.title || "Instructor"}</div>
                <h3 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 10px", letterSpacing: "-0.02em", color: textPrimary }}>{it.name}</h3>
                {it.bio && (
                  <p style={{ fontSize: 14, color: textSecondary, margin: "0 0 12px", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{it.bio}</p>
                )}
                {Array.isArray(it.experience) && it.experience.length > 0 && (
                  <ul style={{ margin: 0, padding: "0 0 0 18px", listStyle: "disc", color: textSecondary, fontSize: 13, lineHeight: 1.7 }}>
                    {it.experience.map((line, j) => <li key={j}>{line}</li>)}
                  </ul>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {section.type === "features" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
          {(items as FeatureItem[]).map((it, i) => (
            <div key={i} style={{ padding: 22, borderRadius: 14, background: cardBg, border: `1px solid ${cardBorder}` }}>
              <div style={{ width: 44, height: 44, borderRadius: 11, background: `${primary}22`, color: primary, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
                <SvgIcon name={it.icon || "star"} size={22} />
              </div>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 8px", letterSpacing: "-0.01em", color: textPrimary }}>{it.title}</h3>
              <p style={{ fontSize: 13.5, color: textSecondary, margin: 0, lineHeight: 1.65 }}>{it.description}</p>
            </div>
          ))}
        </div>
      )}

      {section.type === "management_system" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
          {(items as ManagementCardItem[]).map((it, i) => (
            <div key={i} style={{ padding: 22, borderRadius: 14, background: cardBg, border: `1px solid ${cardBorder}` }}>
              <div style={{ width: 44, height: 44, borderRadius: 11, background: `${primary}22`, color: primary, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
                <SvgIcon name={it.icon || "shield"} size={22} />
              </div>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 8px", letterSpacing: "-0.01em", color: textPrimary }}>{it.title}</h3>
              <p style={{ fontSize: 13.5, color: textSecondary, margin: 0, lineHeight: 1.65 }}>{it.description}</p>
            </div>
          ))}
        </div>
      )}

      {section.type === "process_timeline" && (
        <div style={{ display: "grid", gap: 10 }}>
          {(items as ProcessStepItem[]).map((it, i) => (
            <div key={i} style={{ padding: 18, borderRadius: 14, background: cardBg, border: `1px solid ${cardBorder}`, display: "grid", gridTemplateColumns: "auto 1fr", gap: 16, alignItems: "start" }}>
              <div style={{ minWidth: 64, padding: "6px 12px", borderRadius: 999, background: primary, color: isDark ? "#0A0E1A" : "#fff", fontSize: 12, fontWeight: 800, textAlign: "center", letterSpacing: "-0.01em" }}>
                {it.step_label || `Step ${i + 1}`}
              </div>
              <div style={{ minWidth: 0 }}>
                <h3 style={{ fontSize: 15.5, fontWeight: 700, margin: "0 0 6px", letterSpacing: "-0.01em", color: textPrimary }}>{it.title}</h3>
                <p style={{ fontSize: 13, color: textSecondary, margin: 0, lineHeight: 1.65 }}>{it.description}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {section.type === "programs" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
          {(items as ProgramItem[]).map((it, i) => (
            <div key={i} style={{ padding: 22, borderRadius: 14, background: cardBg, border: `1px solid ${cardBorder}`, position: "relative" }}>
              {it.badge && (
                <span style={{ position: "absolute", top: 14, right: 14, padding: "3px 9px", borderRadius: 999, background: `${primary}22`, color: primary, fontSize: 10, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                  {it.badge}
                </span>
              )}
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 8px", letterSpacing: "-0.01em", color: textPrimary, paddingRight: it.badge ? 60 : 0 }}>{it.title}</h3>
              <p style={{ fontSize: 13.5, color: textSecondary, margin: 0, lineHeight: 1.65 }}>{it.description}</p>
            </div>
          ))}
        </div>
      )}
    </section>
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
