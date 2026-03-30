// PATH: src/features/landing/templates/ProgramPromo.tsx
// 템플릿 4: 프로그램 설명/CTA 중심 홍보형. 활기찬 톤.

import type { FeatureItem, TestimonialItem, ProgramItem, FaqItem } from "../types";
import { getEnabledSections, SvgIcon, FaqAccordion, type TemplateProps } from "./shared";

function hexToRgb(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r}, ${g}, ${b}`;
}

export default function ProgramPromo({ config, isPreview }: TemplateProps) {
  const c = config.primary_color || "#F97316";
  const rgb = hexToRgb(c);
  const sections = getEnabledSections(config);

  return (
    <div style={{ fontFamily: "'Pretendard Variable', 'Pretendard', -apple-system, BlinkMacSystemFont, system-ui, sans-serif", color: "#1a1a2e", background: "#fff", minHeight: "100vh" }}>
      {/* Nav */}
      <nav style={{ position: "sticky", top: 0, zIndex: 50, background: "rgba(255,255,255,0.95)", backdropFilter: "blur(12px)", borderBottom: "1px solid rgba(0,0,0,0.05)", padding: "0 24px" }}>
        <div style={{ maxWidth: 1120, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", height: 64 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {config.logo_url && <img src={config.logo_url} alt="" style={{ height: 32, width: "auto", objectFit: "contain" }} />}
            <span style={{ fontSize: 18, fontWeight: 700 }}>{config.brand_name}</span>
          </div>
          <a href={config.cta_link || "/login"} style={{ padding: "8px 20px", background: c, color: "#fff", borderRadius: 8, fontSize: 14, fontWeight: 600, textDecoration: "none" }}>
            {config.cta_text || "로그인"}
          </a>
        </div>
      </nav>

      {sections.map((section) => {
        switch (section.type) {
          case "hero":
            return (
              <section key="hero" style={{ padding: "80px 24px 64px", textAlign: "center", background: `linear-gradient(180deg, rgba(${rgb}, 0.06) 0%, #fff 100%)` }}>
                <div style={{ maxWidth: 720, margin: "0 auto" }}>
                  <h1 style={{ fontSize: "clamp(30px, 5vw, 48px)", fontWeight: 800, lineHeight: 1.2, margin: "0 0 20px", letterSpacing: "-0.02em" }}>
                    {config.tagline || config.brand_name}
                  </h1>
                  {config.subtitle && (
                    <p style={{ fontSize: "clamp(16px, 2vw, 19px)", lineHeight: 1.7, color: "#64748b", margin: "0 0 40px", maxWidth: 560, marginLeft: "auto", marginRight: "auto" }}>
                      {config.subtitle}
                    </p>
                  )}
                  <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
                    <a
                      href={config.cta_link || "/login"}
                      style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "16px 36px", background: c, color: "#fff", borderRadius: 12, fontSize: 17, fontWeight: 700, textDecoration: "none", boxShadow: `0 4px 20px rgba(${rgb}, 0.35)` }}
                    >
                      {config.cta_text || "지금 시작하기"}
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
                    </a>
                  </div>
                  {config.hero_image_url && (
                    <img src={config.hero_image_url} alt="" style={{ width: "100%", maxWidth: 800, marginTop: 48, borderRadius: 16, objectFit: "cover", aspectRatio: "16/9", boxShadow: "0 8px 30px rgba(0,0,0,0.1)" }} />
                  )}
                </div>
              </section>
            );

          case "features": {
            const items = (section.items as FeatureItem[]) || [];
            return (
              <section key="features" style={{ padding: "80px 24px" }}>
                <div style={{ maxWidth: 1120, margin: "0 auto" }}>
                  <h2 style={{ fontSize: 28, fontWeight: 700, textAlign: "center", margin: "0 0 12px" }}>{section.title || "왜 선택해야 할까요?"}</h2>
                  <p style={{ textAlign: "center", color: "#64748b", fontSize: 15, margin: "0 0 48px" }}>검증된 커리큘럼으로 실력을 키웁니다</p>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 24 }}>
                    {items.map((item, i) => (
                      <div key={i} style={{ padding: "36px 28px", borderRadius: 16, background: "#fff", border: "2px solid #f1f5f9", textAlign: "center" }}>
                        <div style={{ width: 56, height: 56, borderRadius: 16, background: `rgba(${rgb}, 0.1)`, display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 20, color: c }}>
                          <SvgIcon name={item.icon} size={28} />
                        </div>
                        <h3 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 10px" }}>{item.title}</h3>
                        <p style={{ fontSize: 15, lineHeight: 1.7, color: "#64748b", margin: 0 }}>{item.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            );
          }

          case "programs": {
            const items = (section.items as ProgramItem[]) || [];
            return (
              <section key="programs" style={{ padding: "80px 24px", background: "#fafafa" }}>
                <div style={{ maxWidth: 1120, margin: "0 auto" }}>
                  <h2 style={{ fontSize: 28, fontWeight: 700, textAlign: "center", margin: "0 0 48px" }}>프로그램 안내</h2>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 24 }}>
                    {items.map((item, i) => (
                      <div key={i} style={{ padding: 32, borderRadius: 16, background: "#fff", boxShadow: "0 2px 8px rgba(0,0,0,0.04)", border: "1px solid rgba(0,0,0,0.04)" }}>
                        {item.badge && (
                          <span style={{ display: "inline-block", padding: "5px 14px", borderRadius: 99, background: c, color: "#fff", fontSize: 12, fontWeight: 700, marginBottom: 16 }}>{item.badge}</span>
                        )}
                        <h3 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 10px" }}>{item.title}</h3>
                        <p style={{ fontSize: 15, lineHeight: 1.7, color: "#64748b", margin: 0 }}>{item.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            );
          }

          case "about":
            return (
              <section key="about" style={{ padding: "80px 24px" }}>
                <div style={{ maxWidth: 720, margin: "0 auto", textAlign: "center" }}>
                  <h2 style={{ fontSize: 28, fontWeight: 700, margin: "0 0 20px" }}>{section.title || "소개"}</h2>
                  {section.description && <p style={{ fontSize: 17, lineHeight: 1.8, color: "#64748b", margin: 0, whiteSpace: "pre-line" }}>{section.description}</p>}
                </div>
              </section>
            );

          case "testimonials":
            return (
              <section key="testimonials" style={{ padding: "80px 24px", background: "#fafafa" }}>
                <div style={{ maxWidth: 1120, margin: "0 auto" }}>
                  <h2 style={{ fontSize: 28, fontWeight: 700, textAlign: "center", margin: "0 0 48px" }}>수강 후기</h2>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 24 }}>
                    {(section.items as TestimonialItem[] || []).map((item, i) => (
                      <div key={i} style={{ padding: 32, borderRadius: 16, background: "#fff", border: "1px solid rgba(0,0,0,0.04)" }}>
                        <div style={{ display: "flex", gap: 4, marginBottom: 16 }}>
                          {[1, 2, 3, 4, 5].map((s) => <svg key={s} width="16" height="16" viewBox="0 0 24 24" fill={c}><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>)}
                        </div>
                        <p style={{ fontSize: 15, lineHeight: 1.7, color: "#475569", margin: "0 0 16px" }}>{item.text}</p>
                        <p style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>{item.name} <span style={{ fontWeight: 400, color: "#94a3b8" }}>· {item.role}</span></p>
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
                  <h2 style={{ fontSize: 28, fontWeight: 700, textAlign: "center", margin: "0 0 48px" }}>자주 묻는 질문</h2>
                  <FaqAccordion items={section.items as FaqItem[] || []} color={c} />
                </div>
              </section>
            );

          case "contact":
            return (
              <section key="contact" style={{ padding: "64px 24px", background: c, color: "#fff", textAlign: "center" }}>
                <div style={{ maxWidth: 720, margin: "0 auto" }}>
                  <h2 style={{ fontSize: 28, fontWeight: 700, margin: "0 0 16px" }}>상담 문의</h2>
                  <p style={{ fontSize: 16, opacity: 0.85, margin: "0 0 32px" }}>언제든 편하게 연락주세요</p>
                  <div style={{ display: "flex", gap: 32, justifyContent: "center", flexWrap: "wrap" }}>
                    {config.contact?.phone && (
                      <a href={`tel:${config.contact.phone}`} style={{ color: "#fff", textDecoration: "none", fontSize: 18, fontWeight: 700 }}>{config.contact.phone}</a>
                    )}
                    {config.contact?.email && (
                      <a href={`mailto:${config.contact.email}`} style={{ color: "#fff", textDecoration: "none", fontSize: 16 }}>{config.contact.email}</a>
                    )}
                  </div>
                </div>
              </section>
            );

          default:
            return null;
        }
      })}

      <footer style={{ padding: "40px 24px", borderTop: "1px solid rgba(0,0,0,0.06)", textAlign: "center" }}>
        <p style={{ fontSize: 13, color: "#94a3b8", margin: 0 }}>&copy; {new Date().getFullYear()} {config.brand_name}</p>
      </footer>
    </div>
  );
}
