// PATH: src/app_admin/domains/landing/templates/PremiumDark.tsx
// 템플릿 2: 프리미엄 다크 — 검정 + 딥네이비 + 골드 액센트.
// 박철과학 인스타 시그니처(검정/골드/Pretendard heavy) 매칭.
//
// 랜딩 템플릿은 inline style 기반 — 도메인 전체 면제 (MinimalTutor와 동일 사유).
/* eslint-disable no-restricted-syntax, @typescript-eslint/no-unused-vars */

import { useState } from "react";
import { Link } from "react-router-dom";
import type { LandingConfig, LandingSection, FeatureItem, TestimonialItem, ProgramItem, FaqItem, HitReportShowcaseItem, InstructorProfileItem, ManagementCardItem, ProcessStepItem } from "../types";
import { getEnabledSections, SvgIcon, HitReportCards, useTenantHitStats, useResolvedLogo, type TemplateProps } from "./shared";
import { hexToRgb } from "./colorUtils";
import useAuth from "@/auth/hooks/useAuth";

export default function PremiumDark({ config }: TemplateProps) {
  const c = config.primary_color || "#1E3A5F";
  const rgb = hexToRgb(c);
  const sections = getEnabledSections(config);

  // 박철과학 시그니처 다크 팔레트
  const bg = "#0A0E1A";
  const bgAlt = "#0F1525";
  const cardBg = "rgba(255,255,255,0.03)";
  const cardBorder = "rgba(255,255,255,0.08)";
  const cardHoverBorder = "rgba(212,160,76,0.35)";
  const textPrimary = "#F5F1E8";
  const textSecondary = "#9CA3AF";
  const textMuted = "#6B7280";
  const gold = "#D4A04C";
  const goldRgb = "212,160,76";

  return (
    <div style={{
      fontFamily: "'Pretendard Variable', 'Pretendard', -apple-system, BlinkMacSystemFont, system-ui, sans-serif",
      color: textPrimary,
      background: bg,
      minHeight: "100vh",
      letterSpacing: "-0.011em",
    }}>
      {/* Nav — 로고 + 메뉴 + 역할별 진입 + 모바일 햄버거 */}
      <NavBar
        config={config}
        sections={sections}
        gold={gold}
        goldRgb={goldRgb}
        cardBorder={cardBorder}
        textPrimary={textPrimary}
        textSecondary={textSecondary}
      />

      {sections.map((section) => {
        switch (section.type) {
          case "hero":
            return (
              <section key="hero" data-stype="hero" style={{ padding: "120px 24px 100px", position: "relative", overflow: "hidden" }}>
                {/* multi-layer ambient lighting — 깊은 다크 + 골드 글로우 + 네이비 액센트 */}
                <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse 80% 60% at 70% 20%, rgba(${goldRgb},0.12) 0%, transparent 55%)`, pointerEvents: "none" }} />
                <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse 60% 50% at 20% 80%, rgba(${rgb},0.18) 0%, transparent 60%)`, pointerEvents: "none" }} />
                {/* subtle grain */}
                <div style={{ position: "absolute", inset: 0, opacity: 0.4, mixBlendMode: "overlay", pointerEvents: "none",
                  backgroundImage: "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.15'/></svg>\")",
                }} />

                <div style={{ maxWidth: 1200, margin: "0 auto", position: "relative", display: "flex", alignItems: "center", gap: 80, flexWrap: "wrap" }}>
                  <div style={{ flex: "1 1 520px", minWidth: 280 }}>
                    {/* Eyebrow */}
                    <div style={{
                      display: "inline-flex", alignItems: "center", gap: 8,
                      padding: "6px 14px", borderRadius: 99,
                      background: `rgba(${goldRgb},0.08)`, border: `1px solid rgba(${goldRgb},0.25)`,
                      color: gold, fontSize: 12, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase",
                      marginBottom: 24,
                    }}>
                      <span style={{ width: 5, height: 5, borderRadius: "50%", background: gold, boxShadow: `0 0 8px ${gold}` }} />
                      Premium Class
                    </div>

                    <h1 style={{
                      fontSize: "clamp(40px, 6vw, 68px)", fontWeight: 800, lineHeight: 1.08,
                      margin: "0 0 28px", letterSpacing: "-0.035em",
                      background: `linear-gradient(180deg, #FFFFFF 0%, #C9CCD4 100%)`,
                      WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                      backgroundClip: "text",
                    }}>
                      {config.tagline || config.brand_name}
                    </h1>

                    {config.subtitle && (
                      <p style={{
                        fontSize: "clamp(17px, 2vw, 20px)", lineHeight: 1.7,
                        color: textSecondary, margin: "0 0 44px", maxWidth: 560,
                        fontWeight: 400,
                      }}>
                        {config.subtitle}
                      </p>
                    )}

                    <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center" }}>
                      <a
                        href={config.cta_link || "/login"}
                        style={{
                          display: "inline-flex", alignItems: "center", gap: 10,
                          padding: "16px 36px",
                          background: `linear-gradient(135deg, ${gold} 0%, #B8862F 100%)`,
                          color: "#0A0E1A", borderRadius: 12,
                          fontSize: 16, fontWeight: 700, letterSpacing: "-0.01em",
                          textDecoration: "none",
                          boxShadow: `0 12px 32px rgba(${goldRgb},0.35), inset 0 1px 0 rgba(255,255,255,0.25)`,
                        }}
                      >
                        {config.cta_text || "수강 문의"}
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
                      </a>
                      {config.contact?.phone && (
                        <a href={`tel:${config.contact.phone.replace(/-/g,"")}`} style={{
                          display: "inline-flex", alignItems: "center", gap: 8,
                          padding: "16px 24px",
                          background: "transparent", color: textPrimary,
                          border: `1px solid ${cardBorder}`, borderRadius: 12,
                          fontSize: 15, fontWeight: 600, textDecoration: "none",
                          letterSpacing: "-0.01em",
                        }}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" /></svg>
                          {config.contact.phone}
                        </a>
                      )}
                    </div>
                  </div>

                  {config.hero_image_url && (
                    <div style={{ flex: "1 1 420px", minWidth: 280, position: "relative" }}>
                      <div style={{ position: "absolute", inset: -20, background: `radial-gradient(ellipse, rgba(${goldRgb},0.2) 0%, transparent 70%)`, filter: "blur(40px)", pointerEvents: "none" }} />
                      <img
                        src={config.hero_image_url}
                        alt=""
                        style={{
                          position: "relative",
                          width: "100%", borderRadius: 20, objectFit: "cover", aspectRatio: "4/5",
                          border: `1px solid ${cardBorder}`,
                          boxShadow: "0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04) inset",
                        }}
                      />
                    </div>
                  )}
                </div>
              </section>
            );

          case "features":
            return (
              <section key="features" data-stype="features" style={{ padding: "120px 24px", background: bgAlt, position: "relative", overflow: "hidden" }}>
                <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse 60% 40% at 50% 0%, rgba(${goldRgb},0.04) 0%, transparent 70%)`, pointerEvents: "none" }} />
                <div style={{ maxWidth: 1200, margin: "0 auto", position: "relative" }}>
                  {section.title && (
                    <SectionHeader eyebrow="System" title={section.title} gold={gold} goldRgb={goldRgb} textSecondary={textSecondary} />
                  )}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 20, marginTop: 64 }}>
                    {(section.items as FeatureItem[] || []).map((item, i) => (
                      <FeatureCard key={i} item={item} gold={gold} goldRgb={goldRgb} cardBg={cardBg} cardBorder={cardBorder} cardHoverBorder={cardHoverBorder} textSecondary={textSecondary} />
                    ))}
                  </div>
                </div>
              </section>
            );

          case "about":
            return (
              <section key="about" data-stype="about" style={{ padding: "120px 24px", position: "relative" }}>
                <div style={{ maxWidth: 820, margin: "0 auto", textAlign: "center" }}>
                  {section.title && (
                    <SectionHeader eyebrow="About" title={section.title} gold={gold} goldRgb={goldRgb} textSecondary={textSecondary} />
                  )}
                  {section.description && (
                    <p style={{
                      fontSize: 18, lineHeight: 1.85, color: textSecondary,
                      margin: "32px 0 0", whiteSpace: "pre-line", fontWeight: 400,
                    }}>
                      {section.description}
                    </p>
                  )}
                </div>
              </section>
            );

          case "instructor_profile": {
            // 강사 통산 KPI 자동 — 학원장이 picker에 박은 hit_reports의 누적 적중률.
            const hitSec = sections.find((s) => s.type === "hit_reports");
            const reportIds = (hitSec?.items as HitReportShowcaseItem[] | undefined ?? []).map((it) => it.report_id);
            return (
              <section key="instructor_profile" data-stype="instructor_profile" style={{ padding: "120px 24px", position: "relative", overflow: "hidden" }}>
                <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse 50% 60% at 30% 50%, rgba(${goldRgb},0.08) 0%, transparent 60%)`, pointerEvents: "none" }} />
                <div style={{ maxWidth: 1200, margin: "0 auto", position: "relative" }}>
                  <SectionHeader eyebrow="Instructor" title={section.title || "강사 프로필"} description={section.description} gold={gold} goldRgb={goldRgb} textSecondary={textSecondary} />
                  <div style={{ display: "grid", gridTemplateColumns: ((section.items as InstructorProfileItem[] | undefined)?.length || 0) > 1 ? "repeat(auto-fit, minmax(320px, 1fr))" : "1fr", gap: 32, marginTop: 64 }}>
                    {((section.items as InstructorProfileItem[]) || []).map((it, i) => (
                      <InstructorCard key={i} item={it} reportIds={reportIds} gold={gold} goldRgb={goldRgb} cardBg={cardBg} cardBorder={cardBorder} textPrimary={textPrimary} textSecondary={textSecondary} textMuted={textMuted} bg={bg} />
                    ))}
                  </div>
                </div>
              </section>
            );
          }

          case "management_system":
            return (
              <section key="management_system" data-stype="management_system" style={{ padding: "120px 24px", background: bgAlt }}>
                <div style={{ maxWidth: 1200, margin: "0 auto" }}>
                  <SectionHeader eyebrow="Management" title={section.title || "학생 관리 시스템"} description={section.description || "수업 외 시간에도 학생을 끊김 없이 챙깁니다."} gold={gold} goldRgb={goldRgb} textSecondary={textSecondary} />
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 18, marginTop: 56 }}>
                    {((section.items as ManagementCardItem[]) || []).map((it, i) => (
                      <div key={i} style={{
                        padding: 28, borderRadius: 16,
                        background: bg, border: `1px solid ${cardBorder}`,
                        display: "flex", flexDirection: "column", gap: 12,
                      }}>
                        <div style={{
                          width: 44, height: 44, borderRadius: 12,
                          background: `linear-gradient(135deg, rgba(${goldRgb},0.15) 0%, rgba(${goldRgb},0.05) 100%)`,
                          border: `1px solid rgba(${goldRgb},0.2)`,
                          display: "flex", alignItems: "center", justifyContent: "center", color: gold,
                        }}>
                          <SvgIcon name={it.icon} size={22} />
                        </div>
                        <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, letterSpacing: "-0.015em" }}>{it.title}</h3>
                        <p style={{ fontSize: 13.5, lineHeight: 1.65, color: textSecondary, margin: 0, fontWeight: 400 }}>{it.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            );

          case "process_timeline":
            return (
              <section key="process_timeline" data-stype="process_timeline" style={{ padding: "120px 24px", position: "relative" }}>
                <div style={{ maxWidth: 980, margin: "0 auto" }}>
                  <SectionHeader eyebrow="Process" title={section.title || "수업 진행 흐름"} description={section.description || "한 사이클이 어떻게 진행되는지 한눈에 보세요."} gold={gold} goldRgb={goldRgb} textSecondary={textSecondary} />
                  <div style={{ display: "flex", flexDirection: "column", gap: 0, marginTop: 56, position: "relative" }}>
                    {((section.items as ProcessStepItem[]) || []).map((it, i, arr) => (
                      <div key={i} style={{ display: "flex", gap: 24, alignItems: "flex-start", position: "relative", paddingBottom: i === arr.length - 1 ? 0 : 32 }}>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
                          <div style={{
                            width: 56, height: 56, borderRadius: 14,
                            background: `linear-gradient(135deg, ${gold} 0%, #B8862F 100%)`,
                            color: "#0A0E1A", fontSize: 13, fontWeight: 800,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            letterSpacing: "-0.02em",
                            boxShadow: `0 6px 16px rgba(${goldRgb},0.25)`,
                          }}>{it.step_label}</div>
                          {i < arr.length - 1 && (
                            <div style={{ width: 2, flex: 1, minHeight: 40, background: `linear-gradient(180deg, rgba(${goldRgb},0.4) 0%, rgba(${goldRgb},0.05) 100%)`, marginTop: 8 }} />
                          )}
                        </div>
                        <div style={{ flex: 1, paddingTop: 6 }}>
                          <h3 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 8px", letterSpacing: "-0.015em" }}>{it.title}</h3>
                          <p style={{ fontSize: 14.5, lineHeight: 1.7, color: textSecondary, margin: 0 }}>{it.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            );

          case "hit_reports":
            return (
              <section key="hit_reports" data-stype="hit_reports" style={{ padding: "120px 24px", background: bgAlt, position: "relative", overflow: "hidden" }}>
                <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse 50% 40% at 50% 0%, rgba(${goldRgb},0.06) 0%, transparent 70%)`, pointerEvents: "none" }} />
                <div style={{ maxWidth: 1200, margin: "0 auto", position: "relative" }}>
                  <SectionHeader
                    eyebrow="Hit Records"
                    title={section.title || "최근 적중 사례"}
                    description={section.description || "박철T 통합과학 내신반의 최근 학교 시험지 적중 결과입니다."}
                    gold={gold}
                    goldRgb={goldRgb}
                    textSecondary={textSecondary}
                  />
                  <div style={{ marginTop: 56 }}>
                    <HitReportCards
                      items={(section.items as HitReportShowcaseItem[] | undefined) || []}
                      color={gold}
                      rgb={goldRgb}
                      theme="dark"
                    />
                  </div>
                  <p style={{ fontSize: 12, color: textMuted, textAlign: "center", margin: "32px 0 0", letterSpacing: "0.02em" }}>
                    적중수 = 강의 자료에서 큐레이션한 동일·유사 문항 수 / 총 문항수 = 시험지 전체 문항
                  </p>
                </div>
              </section>
            );

          case "programs":
            return (
              <section key="programs" data-stype="programs" style={{ padding: "120px 24px", position: "relative" }}>
                <div style={{ maxWidth: 1200, margin: "0 auto" }}>
                  <SectionHeader eyebrow="Class" title={section.title || "프로그램"} gold={gold} goldRgb={goldRgb} textSecondary={textSecondary} />
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 24, marginTop: 64 }}>
                    {(section.items as ProgramItem[] || []).map((item, i) => (
                      <div key={i} style={{
                        padding: 36, borderRadius: 20,
                        background: `linear-gradient(180deg, rgba(${goldRgb},0.04) 0%, rgba(${goldRgb},0.01) 100%)`,
                        border: `1px solid rgba(${goldRgb},0.2)`,
                        position: "relative", overflow: "hidden",
                      }}>
                        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: `linear-gradient(90deg, transparent, rgba(${goldRgb},0.5), transparent)` }} />
                        {item.badge && (
                          <span style={{
                            display: "inline-block", padding: "5px 12px", borderRadius: 99,
                            background: `linear-gradient(135deg, ${gold} 0%, #B8862F 100%)`,
                            color: "#0A0E1A", fontSize: 12, fontWeight: 700, marginBottom: 18,
                            letterSpacing: "-0.01em",
                          }}>
                            {item.badge}
                          </span>
                        )}
                        <h3 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 12px", letterSpacing: "-0.02em" }}>{item.title}</h3>
                        <p style={{ fontSize: 15, lineHeight: 1.75, color: textSecondary, margin: 0, fontWeight: 400 }}>{item.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            );

          case "testimonials":
            return (
              <section key="testimonials" data-stype="testimonials" style={{ padding: "120px 24px", background: bgAlt }}>
                <div style={{ maxWidth: 1200, margin: "0 auto" }}>
                  <SectionHeader eyebrow="Reviews" title="수강생 후기" gold={gold} goldRgb={goldRgb} textSecondary={textSecondary} />
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 24, marginTop: 64 }}>
                    {(section.items as TestimonialItem[] || []).map((item, i) => (
                      <div key={i} style={{ padding: 32, borderRadius: 16, background: cardBg, border: `1px solid ${cardBorder}` }}>
                        <svg width="32" height="32" viewBox="0 0 24 24" fill={`rgba(${goldRgb},0.4)`}><path d="M4.583 17.321C3.553 16.227 3 15 3 13.011c0-3.5 2.457-6.637 6.03-8.188l.893 1.378c-3.335 1.804-3.987 4.145-4.247 5.621.537-.278 1.24-.375 1.929-.311C9.591 11.692 11 13.166 11 15c0 1.933-1.567 3.5-3.5 3.5-1.07 0-2.038-.438-2.917-1.179zM14.583 17.321C13.553 16.227 13 15 13 13.011c0-3.5 2.457-6.637 6.03-8.188l.893 1.378c-3.335 1.804-3.987 4.145-4.247 5.621.537-.278 1.24-.375 1.929-.311C19.591 11.692 21 13.166 21 15c0 1.933-1.567 3.5-3.5 3.5-1.07 0-2.038-.438-2.917-1.179z" /></svg>
                        <p style={{ fontSize: 15, lineHeight: 1.75, color: textSecondary, margin: "16px 0", fontWeight: 400 }}>{item.text}</p>
                        <div>
                          <p style={{ fontSize: 15, fontWeight: 700, margin: 0, color: textPrimary }}>{item.name}</p>
                          <p style={{ fontSize: 13, color: textMuted, margin: "2px 0 0" }}>{item.role}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            );

          case "faq":
            return (
              <section key="faq" data-stype="faq" style={{ padding: "120px 24px" }}>
                <div style={{ maxWidth: 760, margin: "0 auto" }}>
                  <SectionHeader eyebrow="Q & A" title="자주 묻는 질문" gold={gold} goldRgb={goldRgb} textSecondary={textSecondary} />
                  <div style={{ marginTop: 56 }}>
                    <DarkFaqAccordion items={(section.items as FaqItem[]) || []} cardBorder={cardBorder} textPrimary={textPrimary} textSecondary={textSecondary} />
                  </div>
                </div>
              </section>
            );

          case "contact":
            return (
              <section key="contact" data-stype="contact" style={{ padding: "120px 24px", background: bgAlt }}>
                <div style={{ maxWidth: 760, margin: "0 auto", textAlign: "center" }}>
                  <SectionHeader eyebrow="Contact" title="문의" gold={gold} goldRgb={goldRgb} textSecondary={textSecondary} />
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginTop: 56 }}>
                    {config.contact?.phone && (
                      <ContactCard label="전화" value={config.contact.phone} cardBg={cardBg} cardBorder={cardBorder} textMuted={textMuted} textPrimary={textPrimary} gold={gold} />
                    )}
                    {config.contact?.email && (
                      <ContactCard label="문자" value={config.contact.email} cardBg={cardBg} cardBorder={cardBorder} textMuted={textMuted} textPrimary={textPrimary} gold={gold} />
                    )}
                    {config.contact?.address && (
                      <ContactCard label="주소" value={config.contact.address} cardBg={cardBg} cardBorder={cardBorder} textMuted={textMuted} textPrimary={textPrimary} gold={gold} />
                    )}
                  </div>
                </div>
              </section>
            );

          case "notice":
            return (
              <section key="notice" data-stype="notice" style={{ padding: "48px 24px", background: `rgba(${goldRgb},0.04)`, borderTop: `1px solid rgba(${goldRgb},0.15)`, borderBottom: `1px solid rgba(${goldRgb},0.15)` }}>
                <div style={{ maxWidth: 760, margin: "0 auto", textAlign: "center" }}>
                  <p style={{ fontSize: 15, color: textSecondary, margin: 0, lineHeight: 1.7 }}>{section.description}</p>
                </div>
              </section>
            );

          default:
            return null;
        }
      })}

      <footer style={{ padding: "60px 24px 40px", borderTop: `1px solid ${cardBorder}`, textAlign: "center" }}>
        <p style={{ fontSize: 13, color: textMuted, margin: 0, letterSpacing: "0.02em" }}>
          &copy; {new Date().getFullYear()} {config.brand_name}
        </p>
      </footer>
    </div>
  );
}

/** Section header — eyebrow + title + optional description, 일관된 톤 */
function SectionHeader({ eyebrow, title, description, gold, goldRgb, textSecondary }: { eyebrow: string; title: string; description?: string; gold: string; goldRgb: string; textSecondary: string }) {
  return (
    <div style={{ textAlign: "center", maxWidth: 720, margin: "0 auto" }}>
      <div style={{
        display: "inline-flex", alignItems: "center", gap: 8,
        padding: "5px 12px", borderRadius: 99,
        background: `rgba(${goldRgb},0.08)`, border: `1px solid rgba(${goldRgb},0.2)`,
        color: gold, fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase",
        marginBottom: 18,
      }}>
        {eyebrow}
      </div>
      <h2 style={{
        fontSize: "clamp(28px, 3.5vw, 40px)", fontWeight: 800, margin: 0,
        letterSpacing: "-0.025em", lineHeight: 1.2,
      }}>{title}</h2>
      {description && (
        <p style={{ fontSize: 16, lineHeight: 1.7, color: textSecondary, margin: "16px auto 0", maxWidth: 540, fontWeight: 400 }}>
          {description}
        </p>
      )}
    </div>
  );
}

/** Feature card with hover border luminance */
function FeatureCard({ item, gold, goldRgb, cardBg, cardBorder, cardHoverBorder, textSecondary }: { item: FeatureItem; gold: string; goldRgb: string; cardBg: string; cardBorder: string; cardHoverBorder: string; textSecondary: string }) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        padding: 32, borderRadius: 18,
        background: cardBg,
        border: `1px solid ${hover ? cardHoverBorder : cardBorder}`,
        transition: "border-color 0.25s ease, transform 0.25s ease, box-shadow 0.25s ease",
        transform: hover ? "translateY(-2px)" : "none",
        boxShadow: hover ? `0 16px 40px rgba(${goldRgb},0.08)` : "none",
      }}
    >
      <div style={{
        width: 52, height: 52, borderRadius: 14,
        background: `linear-gradient(135deg, rgba(${goldRgb},0.15) 0%, rgba(${goldRgb},0.05) 100%)`,
        border: `1px solid rgba(${goldRgb},0.2)`,
        display: "flex", alignItems: "center", justifyContent: "center",
        marginBottom: 22, color: gold,
      }}>
        <SvgIcon name={item.icon} size={24} />
      </div>
      <h3 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 10px", letterSpacing: "-0.015em" }}>{item.title}</h3>
      <p style={{ fontSize: 14.5, lineHeight: 1.7, color: textSecondary, margin: 0, fontWeight: 400 }}>{item.description}</p>
    </div>
  );
}

function InstructorCard({ item, reportIds = [], gold, goldRgb, cardBg, cardBorder, textPrimary, textSecondary, textMuted, bg }: { item: InstructorProfileItem; reportIds?: number[]; gold: string; goldRgb: string; cardBg: string; cardBorder: string; textPrimary: string; textSecondary: string; textMuted: string; bg: string }) {
  const initial = (item.name || "").trim().charAt(0) || "•";
  const stats = useTenantHitStats(reportIds);
  return (
    <div style={{
      padding: 36, borderRadius: 20,
      background: `linear-gradient(180deg, rgba(${goldRgb},0.04) 0%, rgba(${goldRgb},0.01) 100%)`,
      border: `1px solid ${cardBorder}`,
      display: "flex", gap: 32, alignItems: "flex-start", flexWrap: "wrap",
      position: "relative", overflow: "hidden",
    }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: `linear-gradient(90deg, transparent, rgba(${goldRgb},0.5), transparent)` }} />
      {/* 사진 (URL 있으면 img, 없으면 이니셜 mark) */}
      <div style={{ flex: "0 0 180px", position: "relative" }}>
        <div style={{ position: "absolute", inset: -8, background: `radial-gradient(ellipse, rgba(${goldRgb},0.18) 0%, transparent 70%)`, filter: "blur(20px)", pointerEvents: "none" }} />
        {item.photo_url ? (
          <img src={item.photo_url} alt={item.name} style={{
            position: "relative", width: 180, height: 220, borderRadius: 16, objectFit: "cover",
            border: `1px solid ${cardBorder}`,
            boxShadow: `0 16px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(${goldRgb},0.12) inset`,
          }} />
        ) : (
          <div style={{
            position: "relative", width: 180, height: 220, borderRadius: 16,
            background: `linear-gradient(135deg, ${bg} 0%, rgba(${goldRgb},0.15) 100%)`,
            border: `1px solid ${cardBorder}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            color: gold, fontSize: 64, fontWeight: 800, letterSpacing: "-0.04em",
          }}>{initial}</div>
        )}
      </div>
      {/* 이름 + 직함 + 경력 + bio */}
      <div style={{ flex: "1 1 280px", minWidth: 280 }}>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "4px 10px", borderRadius: 99,
          background: `rgba(${goldRgb},0.1)`, color: gold,
          fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase",
          marginBottom: 12,
        }}>
          {item.title || "Instructor"}
        </div>
        <h3 style={{ fontSize: 32, fontWeight: 800, margin: "0 0 16px", letterSpacing: "-0.025em", color: textPrimary }}>
          {item.name}
        </h3>
        {item.bio && (
          <p style={{ fontSize: 15, lineHeight: 1.75, color: textSecondary, margin: "0 0 22px", fontWeight: 400, whiteSpace: "pre-line" }}>
            {item.bio}
          </p>
        )}
        {item.experience && item.experience.length > 0 && (
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
            {item.experience.map((line, i) => (
              <li key={i} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14, color: textSecondary, fontWeight: 500 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={gold} strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
                {line}
              </li>
            ))}
          </ul>
        )}
        {stats && stats.reportCount > 0 && (
          <div style={{
            marginTop: 22, paddingTop: 18, borderTop: `1px solid ${cardBorder}`,
            display: "flex", gap: 20, alignItems: "baseline",
          }}>
            <div>
              <div style={{ fontSize: 11, color: textMuted, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 4 }}>통산 적중률</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                <span style={{ fontSize: 28, fontWeight: 800, color: gold, lineHeight: 1, letterSpacing: "-0.02em" }}>{Math.round(stats.avgHitRatePct)}</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: gold, opacity: 0.85 }}>%</span>
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: textMuted, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 4 }}>누적 보고서</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                <span style={{ fontSize: 28, fontWeight: 800, color: textPrimary, lineHeight: 1, letterSpacing: "-0.02em" }}>{stats.reportCount}</span>
                <span style={{ fontSize: 14, fontWeight: 600, color: textSecondary }}>건</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ContactCard({ label, value, cardBg, cardBorder, textMuted, textPrimary, gold }: { label: string; value: string; cardBg: string; cardBorder: string; textMuted: string; textPrimary: string; gold: string }) {
  return (
    <div style={{
      padding: "24px 20px", borderRadius: 14,
      background: cardBg, border: `1px solid ${cardBorder}`,
    }}>
      <p style={{ fontSize: 11, color: textMuted, margin: "0 0 6px", letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 600 }}>
        {label}
      </p>
      <p style={{ fontSize: 16, fontWeight: 600, margin: 0, color: textPrimary, letterSpacing: "-0.01em" }}>{value}</p>
    </div>
  );
}

// 섹션 anchor id 매핑 — nav 메뉴 → 섹션으로 부드러운 스크롤
const SECTION_ANCHORS: Record<string, string> = {
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

/** 풀 nav bar — 데스크탑 = 가로 메뉴, 모바일 = 햄버거 + 슬라이드 패널 */
function NavBar({ config, sections, gold, goldRgb, cardBorder, textPrimary, textSecondary }: { config: LandingConfig; sections: LandingSection[]; gold: string; goldRgb: string; cardBorder: string; textPrimary: string; textSecondary: string }) {
  const [open, setOpen] = useState(false);
  const enabled = sections.filter((s) => s.enabled && SECTION_ANCHORS[s.type]);
  const cta = config.cta_text || "수강 문의";
  const ctaLink = config.cta_link || "/login";
  const logoUrl = useResolvedLogo(config);

  const scrollTo = (sectionType: string) => {
    setOpen(false);
    // 섹션은 sections.map → React가 렌더링한 첫 <section> 순서 = sections.order 기준.
    // section element들 중 sectionType과 매칭되는 것을 찾아 스크롤.
    const all = Array.from(document.querySelectorAll("section[data-stype]")) as HTMLElement[];
    const el = all.find((s) => s.dataset.stype === sectionType);
    if (el) {
      window.scrollTo({ top: el.offsetTop - 80, behavior: "smooth" });
    }
  };

  return (
    <>
      <nav style={{
        position: "sticky", top: 0, zIndex: 50,
        background: "rgba(10,14,26,0.85)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderBottom: `1px solid ${cardBorder}`,
        padding: "0 24px",
      }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", height: 72, gap: 16 }}>
          <Link to="/landing" style={{ display: "flex", alignItems: "center", gap: 12, textDecoration: "none", color: textPrimary, flexShrink: 0 }}>
            {logoUrl ? (
              <img src={logoUrl} alt={config.brand_name} style={{ height: 40, width: "auto", objectFit: "contain", filter: "drop-shadow(0 2px 8px rgba(0,0,0,0.4))" }} />
            ) : (
              <BrandMark name={config.brand_name || "Brand"} gold={gold} />
            )}
            <span style={{ fontSize: 19, fontWeight: 800, letterSpacing: "-0.02em", whiteSpace: "nowrap" }}>{config.brand_name}</span>
          </Link>

          {/* 데스크탑 메뉴 */}
          <div className="landing-nav-desktop" style={{ display: "flex", alignItems: "center", gap: 4, flex: 1, justifyContent: "center", overflow: "hidden" }}>
            {enabled.slice(0, 5).map((s) => (
              <button
                key={s.type}
                type="button"
                onClick={() => scrollTo(s.type)}
                style={{
                  padding: "8px 14px", borderRadius: 8,
                  background: "transparent", border: "none",
                  color: textSecondary, fontSize: 14, fontWeight: 600,
                  cursor: "pointer", letterSpacing: "-0.01em",
                  transition: "color 0.15s",
                  whiteSpace: "nowrap",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.color = textPrimary; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = textSecondary; }}
              >
                {SECTION_ANCHORS[s.type]}
              </button>
            ))}
          </div>

          <div className="landing-nav-cta" style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
            <NavRoleMenu cta={cta} ctaLink={ctaLink} gold={gold} goldRgb={goldRgb} cardBorder={cardBorder} textSecondary={textSecondary} />
          </div>

          {/* 모바일 햄버거 */}
          <button
            type="button"
            className="landing-nav-burger"
            onClick={() => setOpen(true)}
            aria-label="메뉴 열기"
            style={{
              display: "none",
              width: 40, height: 40, borderRadius: 8,
              background: "transparent", border: `1px solid ${cardBorder}`,
              color: textPrimary, cursor: "pointer",
              alignItems: "center", justifyContent: "center",
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M3 12h18M3 18h18" /></svg>
          </button>
        </div>
      </nav>

      {/* 모바일 슬라이드 패널 */}
      {open && (
        <div onClick={() => setOpen(false)} style={{
          position: "fixed", inset: 0, zIndex: 100,
          background: "rgba(10,14,26,0.7)", backdropFilter: "blur(10px)",
        }}>
          <div onClick={(e) => e.stopPropagation()} style={{
            position: "absolute", top: 0, right: 0, bottom: 0,
            width: "min(85vw, 320px)",
            background: "#0F1525",
            borderLeft: `1px solid ${cardBorder}`,
            display: "flex", flexDirection: "column",
            padding: 24,
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 32 }}>
              <span style={{ fontSize: 17, fontWeight: 800, color: textPrimary, letterSpacing: "-0.02em" }}>{config.brand_name}</span>
              <button onClick={() => setOpen(false)} aria-label="닫기" style={{ width: 36, height: 36, borderRadius: 8, background: "transparent", border: "none", color: textPrimary, fontSize: 24, cursor: "pointer" }}>×</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1 }}>
              {enabled.map((s) => (
                <button
                  key={s.type}
                  type="button"
                  onClick={() => scrollTo(s.type)}
                  style={{
                    padding: "14px 12px", borderRadius: 10,
                    background: "transparent", border: "none",
                    color: textPrimary, fontSize: 16, fontWeight: 600,
                    cursor: "pointer", textAlign: "left",
                    letterSpacing: "-0.01em",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                >
                  {SECTION_ANCHORS[s.type]}
                </button>
              ))}
            </div>
            <a
              href={ctaLink}
              style={{
                marginTop: 16, padding: "14px 18px",
                background: `linear-gradient(135deg, ${gold} 0%, #B8862F 100%)`,
                color: "#0A0E1A", borderRadius: 10,
                fontSize: 15, fontWeight: 700, textDecoration: "none",
                textAlign: "center", letterSpacing: "-0.01em",
              }}
            >{cta}</a>
          </div>
        </div>
      )}

      <style>{`
        @media (max-width: 900px) {
          .landing-nav-desktop { display: none !important; }
          .landing-nav-cta { display: none !important; }
          .landing-nav-burger { display: inline-flex !important; }
        }
      `}</style>
    </>
  );
}

/** 브랜드 로고 SVG fallback — config.logo_url 미업로드 시 동적 생성. 골드 underline + 브랜드명. */
function BrandMark({ name, gold }: { name: string; gold: string }) {
  const initial = (name || "").trim().charAt(0) || "•";
  return (
    <div style={{
      width: 40, height: 40, borderRadius: 10,
      background: `linear-gradient(135deg, ${gold} 0%, #8B5E1F 100%)`,
      display: "flex", alignItems: "center", justifyContent: "center",
      color: "#0A0E1A", fontSize: 20, fontWeight: 800,
      boxShadow: `0 4px 12px rgba(212,160,76,0.3), inset 0 1px 0 rgba(255,255,255,0.3)`,
      letterSpacing: "-0.02em",
    }}>{initial}</div>
  );
}

/** 역할별 nav 메뉴 — 비로그인은 "로그인" + "수강 문의", 로그인 시 역할 표시 + 마이페이지 진입. */
function NavRoleMenu({ cta, ctaLink, gold, goldRgb, cardBorder, textSecondary }: { cta: string; ctaLink: string; gold: string; goldRgb: string; cardBorder: string; textSecondary: string }) {
  const { user, isAuthenticated } = useAuth();
  const u = user as { tenantRole?: string | null; is_superuser?: boolean; name?: string | null; username?: string } | null;
  const role = (u?.tenantRole ?? "").toLowerCase();
  // username은 전화번호 형태(01012345678)일 수 있음 — 학원장 개인 폰. 외부 노출 X.
  // 표시명은 name 우선, 없으면 "내 계정" fallback (username 절대 노출 X).
  const displayName = u?.name || "내 계정";

  // 역할별 진입 path
  let myPath = "/admin";
  let roleLabel = "관리실";
  if (role === "student") { myPath = "/student"; roleLabel = "학생 마이페이지"; }
  else if (role === "parent") { myPath = "/student"; roleLabel = "학부모 페이지"; }  // parent도 student app 사용 (read-only)
  else if (role === "teacher") { myPath = "/admin"; roleLabel = "강사 콘솔"; }
  else if (role === "assistant") { myPath = "/admin"; roleLabel = "조교 콘솔"; }
  else if (role === "owner" || role === "admin" || u?.is_superuser) { myPath = "/admin"; roleLabel = "관리실"; }

  if (!isAuthenticated) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Link to="/login" style={{
          padding: "10px 18px", borderRadius: 10, fontSize: 14, fontWeight: 600,
          textDecoration: "none", color: textSecondary,
          border: `1px solid ${cardBorder}`,
        }}>로그인</Link>
        <a href={ctaLink} style={{
          display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 22px",
          background: `linear-gradient(135deg, ${gold} 0%, #B8862F 100%)`,
          color: "#0A0E1A", borderRadius: 10, fontSize: 14, fontWeight: 700,
          textDecoration: "none",
          boxShadow: `0 4px 20px rgba(${goldRgb},0.25)`,
        }}>
          {cta}
          <span style={{ fontSize: 16, lineHeight: 1, marginTop: -1 }}>›</span>
        </a>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <span style={{ fontSize: 13, color: textSecondary, letterSpacing: "-0.01em", display: "none" }} className="nav-greeting">
        {displayName}님
      </span>
      <Link to={myPath} style={{
        display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 18px",
        background: "rgba(255,255,255,0.06)", color: "#F5F1E8",
        border: `1px solid ${cardBorder}`, borderRadius: 10,
        fontSize: 14, fontWeight: 600, textDecoration: "none",
        letterSpacing: "-0.01em",
      }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg>
        {roleLabel}
      </Link>
    </div>
  );
}

function DarkFaqAccordion({ items, cardBorder, textPrimary, textSecondary }: { items: FaqItem[]; cardBorder: string; textPrimary: string; textSecondary: string }) {
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {items.map((item, i) => (
        <div key={i} style={{ borderBottom: `1px solid ${cardBorder}` }}>
          <button onClick={() => setOpenIdx(openIdx === i ? null : i)} style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            width: "100%", padding: "22px 0", background: "none", border: "none",
            cursor: "pointer", fontSize: 16, fontWeight: 600, textAlign: "left",
            color: textPrimary, letterSpacing: "-0.01em",
          }}>
            <span>{item.question}</span>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ transform: openIdx === i ? "rotate(180deg)" : "none", transition: "transform 0.2s", flexShrink: 0, marginLeft: 16 }}><path d="M19 9l-7 7-7-7" /></svg>
          </button>
          {openIdx === i && (
            <div style={{ padding: "0 0 22px", color: textSecondary, fontSize: 15, lineHeight: 1.75 }}>{item.answer}</div>
          )}
        </div>
      ))}
    </div>
  );
}
