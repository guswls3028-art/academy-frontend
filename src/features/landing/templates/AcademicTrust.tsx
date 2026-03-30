// PATH: src/features/landing/templates/AcademicTrust.tsx
// 템플릿 3: 성적/관리/체계 강조형. 신뢰와 체계를 시각적으로 전달.

import type { FeatureItem, TestimonialItem, ProgramItem, FaqItem } from "../types";
import { getEnabledSections, SvgIcon, FaqAccordion, type TemplateProps } from "./shared";

function hexToRgb(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r}, ${g}, ${b}`;
}

export default function AcademicTrust({ config, isPreview }: TemplateProps) {
  const c = config.primary_color || "#4F46E5";
  const rgb = hexToRgb(c);
  const sections = getEnabledSections(config);

  return (
    <div style={{ fontFamily: "'Pretendard Variable', 'Pretendard', -apple-system, BlinkMacSystemFont, system-ui, sans-serif", color: "#1e293b", background: "#ffffff", minHeight: "100vh" }}>
      {/* Nav */}
      <nav style={{ position: "sticky", top: 0, zIndex: 50, background: "#fff", borderBottom: "1px solid #e2e8f0", padding: "0 24px" }}>
        <div style={{ maxWidth: 1120, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", height: 60 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {config.logo_url && <img src={config.logo_url} alt="" style={{ height: 28, width: "auto", objectFit: "contain" }} />}
            <span style={{ fontSize: 17, fontWeight: 700, color: "#1e293b" }}>{config.brand_name}</span>
          </div>
          <a
            href={config.cta_link || "/login"}
            style={{ padding: "8px 18px", background: c, color: "#fff", borderRadius: 6, fontSize: 14, fontWeight: 600, textDecoration: "none" }}
          >
            {config.cta_text || "로그인"}
          </a>
        </div>
      </nav>

      {sections.map((section) => {
        switch (section.type) {
          case "hero":
            return (
              <section key="hero" style={{ padding: "72px 24px 56px", background: c, color: "#fff", position: "relative" }}>
                <div style={{ position: "absolute", inset: 0, background: "linear-gradient(135deg, rgba(0,0,0,0.1) 0%, transparent 60%)", pointerEvents: "none" }} />
                <div style={{ maxWidth: 1120, margin: "0 auto", position: "relative", display: "flex", alignItems: "center", gap: 56, flexWrap: "wrap" }}>
                  <div style={{ flex: "1 1 480px", minWidth: 280 }}>
                    <div style={{ display: "inline-block", padding: "6px 14px", borderRadius: 99, background: "rgba(255,255,255,0.15)", fontSize: 13, fontWeight: 600, marginBottom: 20, letterSpacing: "0.02em" }}>
                      체계적인 학습 관리 시스템
                    </div>
                    <h1 style={{ fontSize: "clamp(28px, 4vw, 42px)", fontWeight: 800, lineHeight: 1.25, margin: "0 0 20px" }}>
                      {config.tagline || config.brand_name}
                    </h1>
                    {config.subtitle && (
                      <p style={{ fontSize: "clamp(15px, 1.8vw, 18px)", lineHeight: 1.7, opacity: 0.85, margin: "0 0 36px", maxWidth: 520 }}>
                        {config.subtitle}
                      </p>
                    )}
                    <a
                      href={config.cta_link || "/login"}
                      style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "14px 32px", background: "#fff", color: c, borderRadius: 8, fontSize: 16, fontWeight: 700, textDecoration: "none" }}
                    >
                      {config.cta_text || "시작하기"}
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
                    </a>
                  </div>
                  {config.hero_image_url && (
                    <div style={{ flex: "1 1 380px", minWidth: 260 }}>
                      <img src={config.hero_image_url} alt="" style={{ width: "100%", borderRadius: 12, objectFit: "cover", aspectRatio: "4/3", boxShadow: "0 12px 40px rgba(0,0,0,0.2)" }} />
                    </div>
                  )}
                </div>
              </section>
            );

          case "features": {
            const items = (section.items as FeatureItem[]) || [];
            return (
              <section key="features" style={{ padding: "72px 24px", background: "#f8fafc" }}>
                <div style={{ maxWidth: 1120, margin: "0 auto" }}>
                  <h2 style={{ fontSize: 26, fontWeight: 700, textAlign: "center", margin: "0 0 12px" }}>{section.title || "관리 시스템"}</h2>
                  <p style={{ textAlign: "center", color: "#64748b", fontSize: 15, margin: "0 0 48px" }}>학생 한 명 한 명을 체계적으로 관리합니다</p>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 20 }}>
                    {items.map((item, i) => (
                      <div key={i} style={{ padding: "28px 24px", borderRadius: 12, background: "#fff", border: "1px solid #e2e8f0", display: "flex", gap: 16, alignItems: "flex-start" }}>
                        <div style={{ width: 40, height: 40, borderRadius: 10, background: c, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: "#fff" }}>
                          <SvgIcon name={item.icon} size={20} />
                        </div>
                        <div>
                          <h3 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 6px" }}>{item.title}</h3>
                          <p style={{ fontSize: 14, lineHeight: 1.6, color: "#64748b", margin: 0 }}>{item.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            );
          }

          case "about":
            return (
              <section key="about" style={{ padding: "72px 24px" }}>
                <div style={{ maxWidth: 720, margin: "0 auto", textAlign: "center" }}>
                  <h2 style={{ fontSize: 26, fontWeight: 700, margin: "0 0 20px" }}>{section.title || "소개"}</h2>
                  {section.description && <p style={{ fontSize: 16, lineHeight: 1.8, color: "#64748b", margin: 0, whiteSpace: "pre-line" }}>{section.description}</p>}
                </div>
              </section>
            );

          case "testimonials":
            return (
              <section key="testimonials" style={{ padding: "72px 24px", background: "#f8fafc" }}>
                <div style={{ maxWidth: 1120, margin: "0 auto" }}>
                  <h2 style={{ fontSize: 26, fontWeight: 700, textAlign: "center", margin: "0 0 48px" }}>학부모 후기</h2>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20 }}>
                    {(section.items as TestimonialItem[] || []).map((item, i) => (
                      <div key={i} style={{ padding: 28, borderRadius: 12, background: "#fff", borderLeft: `3px solid ${c}` }}>
                        <p style={{ fontSize: 15, lineHeight: 1.7, color: "#475569", margin: "0 0 16px" }}>{item.text}</p>
                        <p style={{ fontSize: 14, fontWeight: 600, margin: 0, color: "#1e293b" }}>{item.name} <span style={{ fontWeight: 400, color: "#94a3b8" }}>{item.role}</span></p>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            );

          case "programs":
            return (
              <section key="programs" style={{ padding: "72px 24px" }}>
                <div style={{ maxWidth: 1120, margin: "0 auto" }}>
                  <h2 style={{ fontSize: 26, fontWeight: 700, textAlign: "center", margin: "0 0 48px" }}>프로그램</h2>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 20 }}>
                    {(section.items as ProgramItem[] || []).map((item, i) => (
                      <div key={i} style={{ padding: 28, borderRadius: 12, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                        {item.badge && <span style={{ display: "inline-block", padding: "3px 10px", borderRadius: 4, background: c, color: "#fff", fontSize: 11, fontWeight: 600, marginBottom: 12 }}>{item.badge}</span>}
                        <h3 style={{ fontSize: 17, fontWeight: 700, margin: "0 0 8px" }}>{item.title}</h3>
                        <p style={{ fontSize: 14, lineHeight: 1.6, color: "#64748b", margin: 0 }}>{item.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            );

          case "faq":
            return (
              <section key="faq" style={{ padding: "72px 24px", background: "#f8fafc" }}>
                <div style={{ maxWidth: 720, margin: "0 auto" }}>
                  <h2 style={{ fontSize: 26, fontWeight: 700, textAlign: "center", margin: "0 0 48px" }}>자주 묻는 질문</h2>
                  <FaqAccordion items={section.items as FaqItem[] || []} color={c} />
                </div>
              </section>
            );

          case "contact":
            return (
              <section key="contact" style={{ padding: "72px 24px" }}>
                <div style={{ maxWidth: 720, margin: "0 auto", textAlign: "center" }}>
                  <h2 style={{ fontSize: 26, fontWeight: 700, margin: "0 0 32px" }}>문의</h2>
                  <div style={{ display: "flex", gap: 40, justifyContent: "center", flexWrap: "wrap" }}>
                    {config.contact?.phone && (<div><p style={{ fontSize: 13, color: "#94a3b8", margin: "0 0 4px" }}>전화</p><p style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>{config.contact.phone}</p></div>)}
                    {config.contact?.email && (<div><p style={{ fontSize: 13, color: "#94a3b8", margin: "0 0 4px" }}>이메일</p><p style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>{config.contact.email}</p></div>)}
                    {config.contact?.address && (<div><p style={{ fontSize: 13, color: "#94a3b8", margin: "0 0 4px" }}>주소</p><p style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>{config.contact.address}</p></div>)}
                  </div>
                </div>
              </section>
            );

          default:
            return null;
        }
      })}

      <footer style={{ padding: "36px 24px", borderTop: "1px solid #e2e8f0", textAlign: "center" }}>
        <p style={{ fontSize: 13, color: "#94a3b8", margin: 0 }}>&copy; {new Date().getFullYear()} {config.brand_name}</p>
      </footer>
    </div>
  );
}
