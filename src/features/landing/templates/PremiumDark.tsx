// PATH: src/features/landing/templates/PremiumDark.tsx
// 템플릿 2: 네이비/다크 기반 프리미엄 톤.

import type { FeatureItem, TestimonialItem, ProgramItem, FaqItem } from "../types";
import { getEnabledSections, SvgIcon, FaqAccordion, type TemplateProps } from "./shared";

function hexToRgb(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r}, ${g}, ${b}`;
}

export default function PremiumDark({ config, isPreview }: TemplateProps) {
  const c = config.primary_color || "#1E3A5F";
  const rgb = hexToRgb(c);
  const sections = getEnabledSections(config);
  const bg = "#0B1120";
  const cardBg = "#111827";
  const textPrimary = "#f1f5f9";
  const textSecondary = "#94a3b8";
  const borderColor = "rgba(255,255,255,0.06)";

  return (
    <div style={{ fontFamily: "'Pretendard Variable', 'Pretendard', -apple-system, BlinkMacSystemFont, system-ui, sans-serif", color: textPrimary, background: bg, minHeight: "100vh" }}>
      {/* Nav */}
      <nav style={{ position: "sticky", top: 0, zIndex: 50, background: "rgba(11,17,32,0.92)", backdropFilter: "blur(16px)", borderBottom: `1px solid ${borderColor}`, padding: "0 24px" }}>
        <div style={{ maxWidth: 1120, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", height: 64 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {config.logo_url && <img src={config.logo_url} alt="" style={{ height: 32, width: "auto", objectFit: "contain" }} />}
            <span style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.02em" }}>{config.brand_name}</span>
          </div>
          <a
            href={config.cta_link || "/login"}
            style={{
              display: "inline-flex", alignItems: "center", padding: "8px 20px",
              background: `rgba(${rgb}, 0.8)`, color: "#fff", borderRadius: 8,
              fontSize: 14, fontWeight: 600, textDecoration: "none",
              border: `1px solid rgba(${rgb}, 0.4)`,
            }}
          >
            {config.cta_text || "로그인"}
          </a>
        </div>
      </nav>

      {sections.map((section) => {
        switch (section.type) {
          case "hero":
            return (
              <section key="hero" style={{ padding: "96px 24px 80px", position: "relative", overflow: "hidden" }}>
                <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, background: `radial-gradient(ellipse at 30% 20%, rgba(${rgb}, 0.15) 0%, transparent 60%)`, pointerEvents: "none" }} />
                <div style={{ maxWidth: 1120, margin: "0 auto", position: "relative", display: "flex", alignItems: "center", gap: 64, flexWrap: "wrap" }}>
                  <div style={{ flex: "1 1 480px", minWidth: 280 }}>
                    <h1 style={{ fontSize: "clamp(32px, 4.5vw, 48px)", fontWeight: 800, lineHeight: 1.2, margin: "0 0 24px", letterSpacing: "-0.03em" }}>
                      {config.tagline || config.brand_name}
                    </h1>
                    {config.subtitle && (
                      <p style={{ fontSize: "clamp(16px, 2vw, 18px)", lineHeight: 1.8, color: textSecondary, margin: "0 0 40px", maxWidth: 520 }}>
                        {config.subtitle}
                      </p>
                    )}
                    <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                      <a
                        href={config.cta_link || "/login"}
                        style={{
                          display: "inline-flex", alignItems: "center", gap: 8,
                          padding: "14px 32px", background: c, color: "#fff",
                          borderRadius: 10, fontSize: 16, fontWeight: 700,
                          textDecoration: "none", boxShadow: `0 0 24px rgba(${rgb}, 0.4)`,
                        }}
                      >
                        {config.cta_text || "시작하기"}
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
                      </a>
                    </div>
                  </div>
                  {config.hero_image_url && (
                    <div style={{ flex: "1 1 400px", minWidth: 280 }}>
                      <img
                        src={config.hero_image_url}
                        alt=""
                        style={{ width: "100%", borderRadius: 16, objectFit: "cover", aspectRatio: "4/3", border: `1px solid ${borderColor}`, boxShadow: `0 16px 48px rgba(0,0,0,0.4)` }}
                      />
                    </div>
                  )}
                </div>
              </section>
            );

          case "features":
            return (
              <section key="features" style={{ padding: "80px 24px" }}>
                <div style={{ maxWidth: 1120, margin: "0 auto" }}>
                  {section.title && <h2 style={{ fontSize: 28, fontWeight: 700, textAlign: "center", margin: "0 0 48px" }}>{section.title}</h2>}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 24 }}>
                    {(section.items as FeatureItem[] || []).map((item, i) => (
                      <div key={i} style={{ padding: 32, borderRadius: 16, background: cardBg, border: `1px solid ${borderColor}` }}>
                        <div style={{ width: 48, height: 48, borderRadius: 12, background: `rgba(${rgb}, 0.15)`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20, color: c }}>
                          <SvgIcon name={item.icon} size={24} />
                        </div>
                        <h3 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 10px" }}>{item.title}</h3>
                        <p style={{ fontSize: 15, lineHeight: 1.7, color: textSecondary, margin: 0 }}>{item.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            );

          case "about":
            return (
              <section key="about" style={{ padding: "80px 24px", background: cardBg }}>
                <div style={{ maxWidth: 720, margin: "0 auto", textAlign: "center" }}>
                  <h2 style={{ fontSize: 28, fontWeight: 700, margin: "0 0 20px" }}>{section.title || "소개"}</h2>
                  {section.description && (
                    <p style={{ fontSize: 17, lineHeight: 1.8, color: textSecondary, margin: 0, whiteSpace: "pre-line" }}>
                      {section.description}
                    </p>
                  )}
                </div>
              </section>
            );

          case "testimonials":
            return (
              <section key="testimonials" style={{ padding: "80px 24px" }}>
                <div style={{ maxWidth: 1120, margin: "0 auto" }}>
                  <h2 style={{ fontSize: 28, fontWeight: 700, textAlign: "center", margin: "0 0 48px" }}>수강생 후기</h2>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 24 }}>
                    {(section.items as TestimonialItem[] || []).map((item, i) => (
                      <div key={i} style={{ padding: 32, borderRadius: 16, background: cardBg, border: `1px solid ${borderColor}` }}>
                        <svg width="28" height="28" viewBox="0 0 24 24" fill={`rgba(${rgb}, 0.3)`}><path d="M4.583 17.321C3.553 16.227 3 15 3 13.011c0-3.5 2.457-6.637 6.03-8.188l.893 1.378c-3.335 1.804-3.987 4.145-4.247 5.621.537-.278 1.24-.375 1.929-.311C9.591 11.692 11 13.166 11 15c0 1.933-1.567 3.5-3.5 3.5-1.07 0-2.038-.438-2.917-1.179zM14.583 17.321C13.553 16.227 13 15 13 13.011c0-3.5 2.457-6.637 6.03-8.188l.893 1.378c-3.335 1.804-3.987 4.145-4.247 5.621.537-.278 1.24-.375 1.929-.311C19.591 11.692 21 13.166 21 15c0 1.933-1.567 3.5-3.5 3.5-1.07 0-2.038-.438-2.917-1.179z" /></svg>
                        <p style={{ fontSize: 15, lineHeight: 1.7, color: textSecondary, margin: "16px 0" }}>{item.text}</p>
                        <div><p style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>{item.name}</p><p style={{ fontSize: 13, color: "#64748b", margin: "2px 0 0" }}>{item.role}</p></div>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            );

          case "programs":
            return (
              <section key="programs" style={{ padding: "80px 24px", background: cardBg }}>
                <div style={{ maxWidth: 1120, margin: "0 auto" }}>
                  <h2 style={{ fontSize: 28, fontWeight: 700, textAlign: "center", margin: "0 0 48px" }}>프로그램</h2>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 24 }}>
                    {(section.items as ProgramItem[] || []).map((item, i) => (
                      <div key={i} style={{ padding: 32, borderRadius: 16, background: bg, border: `1px solid ${borderColor}` }}>
                        {item.badge && (
                          <span style={{ display: "inline-block", padding: "4px 12px", borderRadius: 99, background: `rgba(${rgb}, 0.15)`, color: c, fontSize: 12, fontWeight: 600, marginBottom: 16 }}>{item.badge}</span>
                        )}
                        <h3 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 10px" }}>{item.title}</h3>
                        <p style={{ fontSize: 15, lineHeight: 1.7, color: textSecondary, margin: 0 }}>{item.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            );

          case "faq":
            return (
              <section key="faq" style={{ padding: "80px 24px" }}>
                <div style={{ maxWidth: 720, margin: "0 auto" }}>
                  <h2 style={{ fontSize: 28, fontWeight: 700, textAlign: "center", margin: "0 0 48px", color: textPrimary }}>자주 묻는 질문</h2>
                  <DarkFaqAccordion items={(section.items as FaqItem[]) || []} borderColor={borderColor} textPrimary={textPrimary} textSecondary={textSecondary} />
                </div>
              </section>
            );

          case "contact":
            return (
              <section key="contact" style={{ padding: "80px 24px", background: cardBg }}>
                <div style={{ maxWidth: 720, margin: "0 auto", textAlign: "center" }}>
                  <h2 style={{ fontSize: 28, fontWeight: 700, margin: "0 0 32px" }}>문의</h2>
                  <div style={{ display: "flex", gap: 40, justifyContent: "center", flexWrap: "wrap" }}>
                    {config.contact?.phone && (<div><p style={{ fontSize: 13, color: "#64748b", margin: "0 0 4px" }}>전화</p><p style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>{config.contact.phone}</p></div>)}
                    {config.contact?.email && (<div><p style={{ fontSize: 13, color: "#64748b", margin: "0 0 4px" }}>이메일</p><p style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>{config.contact.email}</p></div>)}
                    {config.contact?.address && (<div><p style={{ fontSize: 13, color: "#64748b", margin: "0 0 4px" }}>주소</p><p style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>{config.contact.address}</p></div>)}
                  </div>
                </div>
              </section>
            );

          default:
            return null;
        }
      })}

      <footer style={{ padding: "40px 24px", borderTop: `1px solid ${borderColor}`, textAlign: "center" }}>
        <p style={{ fontSize: 13, color: "#64748b", margin: 0 }}>&copy; {new Date().getFullYear()} {config.brand_name}</p>
      </footer>
    </div>
  );
}

/** 다크 테마용 FAQ 아코디언 — hooks 규칙 준수를 위해 별도 컴포넌트 */
import { useState } from "react";
function DarkFaqAccordion({ items, borderColor, textPrimary, textSecondary }: { items: FaqItem[]; borderColor: string; textPrimary: string; textSecondary: string }) {
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {items.map((item, i) => (
        <div key={i} style={{ borderBottom: `1px solid ${borderColor}` }}>
          <button onClick={() => setOpenIdx(openIdx === i ? null : i)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", padding: "20px 0", background: "none", border: "none", cursor: "pointer", fontSize: 16, fontWeight: 500, textAlign: "left", color: textPrimary }}>
            <span>{item.question}</span>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ transform: openIdx === i ? "rotate(180deg)" : "none", transition: "transform 0.2s", flexShrink: 0, marginLeft: 16 }}><path d="M19 9l-7 7-7-7" /></svg>
          </button>
          {openIdx === i && <div style={{ padding: "0 0 20px", color: textSecondary, fontSize: 15, lineHeight: 1.7 }}>{item.answer}</div>}
        </div>
      ))}
    </div>
  );
}
