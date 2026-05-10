// PATH: src/app_admin/domains/landing/templates/MinimalTutor.tsx
// 템플릿 1: 밝고 깔끔한 미니멀 디자인. 넓은 여백, 신뢰감.
//
// 랜딩 템플릿은 본질적으로 inline style 기반(테넌트 primary_color 동적 주입 + 격리된 스타일 시스템).
// 디자인 시스템 토큰/CSS 모듈로 추출하면 테넌트별 동적 컬러가 깨지므로 inline 룰은 이 도메인에 한해 면제.
/* eslint-disable no-restricted-syntax */

import { Link } from "react-router-dom";
import type { FeatureItem, TestimonialItem, ProgramItem, FaqItem, HitReportShowcaseItem, InstructorProfileItem, ManagementCardItem, ProcessStepItem } from "../types";
import { getEnabledSections, SvgIcon, FaqAccordion, HitReportCards, useTenantHitStats, type TemplateProps } from "./shared";
import { hexToRgb } from "./colorUtils";
import useAuth from "@/auth/hooks/useAuth";

export default function MinimalTutor({ config }: TemplateProps) {
  const c = config.primary_color || "#2563EB";
  const rgb = hexToRgb(c);
  const sections = getEnabledSections(config);

  return (
    <div style={{ fontFamily: "'Pretendard Variable', 'Pretendard', -apple-system, BlinkMacSystemFont, system-ui, sans-serif", color: "#1a1a2e", background: "#ffffff", minHeight: "100vh" }}>
      {/* Nav — 로고 + 브랜드명 + 역할별 진입 메뉴 */}
      <nav style={{ position: "sticky", top: 0, zIndex: 50, background: "rgba(255,255,255,0.92)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", borderBottom: "1px solid rgba(0,0,0,0.06)", padding: "0 24px" }}>
        <div style={{ maxWidth: 1120, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", height: 68, gap: 16 }}>
          <Link to="/" style={{ display: "flex", alignItems: "center", gap: 12, textDecoration: "none", color: "#0f172a" }}>
            {config.logo_url ? (
              <img src={config.logo_url} alt={config.brand_name} style={{ height: 36, width: "auto", objectFit: "contain" }} />
            ) : (
              <LightBrandMark name={config.brand_name || "Brand"} color={c} />
            )}
            <span style={{ fontSize: 18, fontWeight: 700, color: "#0f172a", letterSpacing: "-0.015em" }}>{config.brand_name}</span>
          </Link>
          <LightNavRoleMenu cta={config.cta_text || "수강 문의"} ctaLink={config.cta_link || "/login"} color={c} rgb={rgb} />
        </div>
      </nav>

      {sections.map((section) => {
        switch (section.type) {
          case "hero":
            return (
              <section key="hero" style={{ padding: "80px 24px 64px", background: `linear-gradient(135deg, rgba(${rgb}, 0.03) 0%, rgba(${rgb}, 0.08) 100%)` }}>
                <div style={{ maxWidth: 1120, margin: "0 auto", display: "flex", alignItems: "center", gap: 64, flexWrap: "wrap" }}>
                  <div style={{ flex: "1 1 480px", minWidth: 280 }}>
                    <h1 style={{ fontSize: "clamp(28px, 4vw, 44px)", fontWeight: 800, lineHeight: 1.25, margin: "0 0 20px", color: "#0f172a" }}>
                      {config.tagline || config.brand_name}
                    </h1>
                    {config.subtitle && (
                      <p style={{ fontSize: "clamp(16px, 2vw, 19px)", lineHeight: 1.7, color: "#64748b", margin: "0 0 36px", maxWidth: 520 }}>
                        {config.subtitle}
                      </p>
                    )}
                    <a
                      href={config.cta_link || "/login"}
                      style={{
                        display: "inline-flex", alignItems: "center", gap: 8,
                        padding: "14px 32px", background: c, color: "#fff",
                        borderRadius: 10, fontSize: 16, fontWeight: 700,
                        textDecoration: "none", boxShadow: `0 4px 14px rgba(${rgb}, 0.3)`,
                      }}
                    >
                      {config.cta_text || "시작하기"}
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
                    </a>
                  </div>
                  {config.hero_image_url && (
                    <div style={{ flex: "1 1 400px", minWidth: 280 }}>
                      <img
                        src={config.hero_image_url}
                        alt=""
                        style={{ width: "100%", borderRadius: 16, objectFit: "cover", aspectRatio: "4/3", boxShadow: "0 8px 30px rgba(0,0,0,0.08)" }}
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
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 32 }}>
                    {(section.items as FeatureItem[] || []).map((item, i) => (
                      <div key={i} style={{ padding: 32, borderRadius: 16, background: "#f8fafc", border: "1px solid rgba(0,0,0,0.04)", transition: "box-shadow 0.2s" }}>
                        <div style={{ width: 48, height: 48, borderRadius: 12, background: `rgba(${rgb}, 0.1)`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20, color: c }}>
                          <SvgIcon name={item.icon} size={24} />
                        </div>
                        <h3 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 10px" }}>{item.title}</h3>
                        <p style={{ fontSize: 15, lineHeight: 1.7, color: "#64748b", margin: 0 }}>{item.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            );

          case "about":
            return (
              <section key="about" style={{ padding: "80px 24px", background: "#f8fafc" }}>
                <div style={{ maxWidth: 720, margin: "0 auto", textAlign: "center" }}>
                  <h2 style={{ fontSize: 28, fontWeight: 700, margin: "0 0 20px" }}>{section.title || "소개"}</h2>
                  {section.description && (
                    <p style={{ fontSize: 17, lineHeight: 1.8, color: "#64748b", margin: 0, whiteSpace: "pre-line" }}>
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
                      <div key={i} style={{ padding: 32, borderRadius: 16, background: "#fff", border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
                        <svg width="32" height="32" viewBox="0 0 24 24" fill={`rgba(${rgb}, 0.15)`}><path d="M4.583 17.321C3.553 16.227 3 15 3 13.011c0-3.5 2.457-6.637 6.03-8.188l.893 1.378c-3.335 1.804-3.987 4.145-4.247 5.621.537-.278 1.24-.375 1.929-.311C9.591 11.692 11 13.166 11 15c0 1.933-1.567 3.5-3.5 3.5-1.07 0-2.038-.438-2.917-1.179zM14.583 17.321C13.553 16.227 13 15 13 13.011c0-3.5 2.457-6.637 6.03-8.188l.893 1.378c-3.335 1.804-3.987 4.145-4.247 5.621.537-.278 1.24-.375 1.929-.311C19.591 11.692 21 13.166 21 15c0 1.933-1.567 3.5-3.5 3.5-1.07 0-2.038-.438-2.917-1.179z" /></svg>
                        <p style={{ fontSize: 15, lineHeight: 1.7, color: "#475569", margin: "16px 0" }}>{item.text}</p>
                        <div>
                          <p style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>{item.name}</p>
                          <p style={{ fontSize: 13, color: "#94a3b8", margin: "2px 0 0" }}>{item.role}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            );

          case "programs":
            return (
              <section key="programs" style={{ padding: "80px 24px", background: "#f8fafc" }}>
                <div style={{ maxWidth: 1120, margin: "0 auto" }}>
                  <h2 style={{ fontSize: 28, fontWeight: 700, textAlign: "center", margin: "0 0 48px" }}>프로그램</h2>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 24 }}>
                    {(section.items as ProgramItem[] || []).map((item, i) => (
                      <div key={i} style={{ padding: 32, borderRadius: 16, background: "#fff", border: "1px solid rgba(0,0,0,0.06)" }}>
                        {item.badge && (
                          <span style={{ display: "inline-block", padding: "4px 12px", borderRadius: 99, background: `rgba(${rgb}, 0.1)`, color: c, fontSize: 12, fontWeight: 600, marginBottom: 16 }}>
                            {item.badge}
                          </span>
                        )}
                        <h3 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 10px" }}>{item.title}</h3>
                        <p style={{ fontSize: 15, lineHeight: 1.7, color: "#64748b", margin: 0 }}>{item.description}</p>
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

          case "notice":
            return (
              <section key="notice" style={{ padding: "48px 24px", background: `rgba(${rgb}, 0.04)` }}>
                <div style={{ maxWidth: 720, margin: "0 auto", textAlign: "center" }}>
                  <p style={{ fontSize: 15, color: "#64748b", margin: 0, lineHeight: 1.7 }}>{section.description}</p>
                </div>
              </section>
            );

          case "hit_reports":
            return (
              <section key="hit_reports" style={{ padding: "80px 24px", background: "#fff" }}>
                <div style={{ maxWidth: 1120, margin: "0 auto" }}>
                  <h2 style={{ fontSize: 28, fontWeight: 700, textAlign: "center", margin: "0 0 12px" }}>
                    {section.title || "최근 적중 사례"}
                  </h2>
                  {section.description && (
                    <p style={{ fontSize: 15, color: "#64748b", textAlign: "center", margin: "0 0 36px", maxWidth: 560, marginInline: "auto", lineHeight: 1.7 }}>
                      {section.description}
                    </p>
                  )}
                  <HitReportCards
                    items={(section.items as HitReportShowcaseItem[] | undefined) || []}
                    color={c}
                    rgb={rgb}
                  />
                  <p style={{ fontSize: 12, color: "#94a3b8", textAlign: "center", margin: "24px 0 0" }}>
                    적중수 = 강의 자료에서 큐레이션한 동일·유사 문항 수 / 총 문항수 = 시험지 전체 문항.
                  </p>
                </div>
              </section>
            );

          case "instructor_profile": {
            const hitSec = sections.find((s) => s.type === "hit_reports");
            const reportIds = (hitSec?.items as HitReportShowcaseItem[] | undefined ?? []).map((it) => it.report_id);
            return (
              <section key="instructor_profile" style={{ padding: "80px 24px", background: "#fff" }}>
                <div style={{ maxWidth: 1120, margin: "0 auto" }}>
                  <h2 style={{ fontSize: 28, fontWeight: 700, textAlign: "center", margin: "0 0 12px" }}>
                    {section.title || "강사 프로필"}
                  </h2>
                  {section.description && (
                    <p style={{ fontSize: 15, color: "#64748b", textAlign: "center", margin: "0 0 36px", maxWidth: 560, marginInline: "auto", lineHeight: 1.7 }}>
                      {section.description}
                    </p>
                  )}
                  <div style={{ display: "grid", gridTemplateColumns: ((section.items as InstructorProfileItem[] | undefined)?.length || 0) > 1 ? "repeat(auto-fit, minmax(320px, 1fr))" : "1fr", gap: 24, marginTop: 32 }}>
                    {((section.items as InstructorProfileItem[]) || []).map((it, i) => (
                      <LightInstructorCard key={i} item={it} reportIds={reportIds} color={c} rgb={rgb} />
                    ))}
                  </div>
                </div>
              </section>
            );
          }

          case "management_system":
            return (
              <section key="management_system" style={{ padding: "80px 24px", background: "#f8fafc" }}>
                <div style={{ maxWidth: 1120, margin: "0 auto" }}>
                  <h2 style={{ fontSize: 28, fontWeight: 700, textAlign: "center", margin: "0 0 12px" }}>
                    {section.title || "학생 관리 시스템"}
                  </h2>
                  {section.description && (
                    <p style={{ fontSize: 15, color: "#64748b", textAlign: "center", margin: "0 0 36px", maxWidth: 560, marginInline: "auto", lineHeight: 1.7 }}>
                      {section.description}
                    </p>
                  )}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
                    {((section.items as ManagementCardItem[]) || []).map((it, i) => (
                      <div key={i} style={{ padding: 24, borderRadius: 14, background: "#fff", border: "1px solid rgba(0,0,0,0.05)", display: "flex", flexDirection: "column", gap: 10 }}>
                        <div style={{ width: 40, height: 40, borderRadius: 10, background: `rgba(${rgb}, 0.1)`, display: "flex", alignItems: "center", justifyContent: "center", color: c }}>
                          <SvgIcon name={it.icon} size={20} />
                        </div>
                        <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: "#0f172a", letterSpacing: "-0.01em" }}>{it.title}</h3>
                        <p style={{ fontSize: 13.5, lineHeight: 1.65, color: "#64748b", margin: 0 }}>{it.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            );

          case "process_timeline":
            return (
              <section key="process_timeline" style={{ padding: "80px 24px", background: "#fff" }}>
                <div style={{ maxWidth: 880, margin: "0 auto" }}>
                  <h2 style={{ fontSize: 28, fontWeight: 700, textAlign: "center", margin: "0 0 12px" }}>
                    {section.title || "수업 진행 흐름"}
                  </h2>
                  {section.description && (
                    <p style={{ fontSize: 15, color: "#64748b", textAlign: "center", margin: "0 0 36px", maxWidth: 560, marginInline: "auto", lineHeight: 1.7 }}>
                      {section.description}
                    </p>
                  )}
                  <div style={{ display: "flex", flexDirection: "column", gap: 0, marginTop: 32 }}>
                    {((section.items as ProcessStepItem[]) || []).map((it, i, arr) => (
                      <div key={i} style={{ display: "flex", gap: 20, alignItems: "flex-start", paddingBottom: i === arr.length - 1 ? 0 : 28 }}>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
                          <div style={{
                            width: 50, height: 50, borderRadius: 12,
                            background: c, color: "#fff",
                            fontSize: 12, fontWeight: 800,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            letterSpacing: "-0.02em",
                            boxShadow: `0 4px 12px rgba(${rgb}, 0.2)`,
                          }}>{it.step_label}</div>
                          {i < arr.length - 1 && (
                            <div style={{ width: 2, flex: 1, minHeight: 36, background: `rgba(${rgb}, 0.2)`, marginTop: 6 }} />
                          )}
                        </div>
                        <div style={{ flex: 1, paddingTop: 6 }}>
                          <h3 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 6px", color: "#0f172a", letterSpacing: "-0.015em" }}>{it.title}</h3>
                          <p style={{ fontSize: 14, lineHeight: 1.7, color: "#64748b", margin: 0 }}>{it.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            );

          case "contact":
            return (
              <section key="contact" style={{ padding: "80px 24px", background: "#f8fafc" }}>
                <div style={{ maxWidth: 720, margin: "0 auto", textAlign: "center" }}>
                  <h2 style={{ fontSize: 28, fontWeight: 700, margin: "0 0 32px" }}>문의</h2>
                  <div style={{ display: "flex", gap: 40, justifyContent: "center", flexWrap: "wrap" }}>
                    {config.contact?.phone && (
                      <div><p style={{ fontSize: 13, color: "#94a3b8", margin: "0 0 4px" }}>전화</p><p style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>{config.contact.phone}</p></div>
                    )}
                    {config.contact?.email && (
                      <div><p style={{ fontSize: 13, color: "#94a3b8", margin: "0 0 4px" }}>이메일</p><p style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>{config.contact.email}</p></div>
                    )}
                    {config.contact?.address && (
                      <div><p style={{ fontSize: 13, color: "#94a3b8", margin: "0 0 4px" }}>주소</p><p style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>{config.contact.address}</p></div>
                    )}
                  </div>
                </div>
              </section>
            );

          default:
            return null;
        }
      })}

      {/* Footer */}
      <footer style={{ padding: "40px 24px", borderTop: "1px solid rgba(0,0,0,0.06)", textAlign: "center" }}>
        <p style={{ fontSize: 13, color: "#94a3b8", margin: 0 }}>
          &copy; {new Date().getFullYear()} {config.brand_name}
        </p>
      </footer>
    </div>
  );
}

/** 로고 미업로드 시 fallback — 브랜드 첫 글자 + 테마 컬러 */
function LightBrandMark({ name, color }: { name: string; color: string }) {
  const initial = (name || "").trim().charAt(0) || "•";
  return (
    <div style={{
      width: 36, height: 36, borderRadius: 9,
      background: color, color: "#fff",
      fontSize: 17, fontWeight: 800,
      display: "flex", alignItems: "center", justifyContent: "center",
      letterSpacing: "-0.02em",
    }}>{initial}</div>
  );
}

/** 역할별 nav 메뉴 — 비로그인은 "로그인" + CTA, 로그인 시 역할별 마이페이지 진입 */
function LightNavRoleMenu({ cta, ctaLink, color, rgb }: { cta: string; ctaLink: string; color: string; rgb: string }) {
  const { user, isAuthenticated } = useAuth();
  const u = user as { tenantRole?: string | null; is_superuser?: boolean } | null;
  const role = (u?.tenantRole ?? "").toLowerCase();
  let myPath = "/admin";
  let roleLabel = "관리실";
  if (role === "student") { myPath = "/student"; roleLabel = "학생 마이페이지"; }
  else if (role === "parent") { myPath = "/student"; roleLabel = "학부모 페이지"; }  // parent도 student app 사용 (read-only)
  else if (role === "teacher") { myPath = "/admin"; roleLabel = "강사 콘솔"; }
  else if (role === "assistant") { myPath = "/admin"; roleLabel = "조교 콘솔"; }

  if (!isAuthenticated) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Link to="/login" style={{
          padding: "8px 16px", borderRadius: 8, fontSize: 14, fontWeight: 600,
          textDecoration: "none", color: "#475569",
          border: "1px solid rgba(0,0,0,0.1)",
        }}>로그인</Link>
        <a href={ctaLink} style={{
          display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 18px",
          background: color, color: "#fff", borderRadius: 8,
          fontSize: 14, fontWeight: 600, textDecoration: "none",
          boxShadow: `0 4px 14px rgba(${rgb}, 0.25)`,
        }}>
          {cta}
          <span style={{ fontSize: 14, lineHeight: 1, marginTop: -1 }}>›</span>
        </a>
      </div>
    );
  }
  return (
    <Link to={myPath} style={{
      display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 16px",
      background: "rgba(0,0,0,0.03)", color: "#0f172a",
      border: "1px solid rgba(0,0,0,0.08)", borderRadius: 8,
      fontSize: 14, fontWeight: 600, textDecoration: "none", letterSpacing: "-0.01em",
    }}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg>
      {roleLabel}
    </Link>
  );
}

/** 강사 프로필 카드 — light tone */
function LightInstructorCard({ item, reportIds = [], color, rgb }: { item: InstructorProfileItem; reportIds?: number[]; color: string; rgb: string }) {
  const initial = (item.name || "").trim().charAt(0) || "•";
  const stats = useTenantHitStats(reportIds);
  return (
    <div style={{
      padding: 32, borderRadius: 18, background: "#fff",
      border: "1px solid rgba(0,0,0,0.06)",
      display: "flex", gap: 28, alignItems: "flex-start", flexWrap: "wrap",
      boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
    }}>
      <div style={{ flex: "0 0 160px" }}>
        {item.photo_url ? (
          <img src={item.photo_url} alt={item.name} style={{
            width: 160, height: 200, borderRadius: 14, objectFit: "cover",
            border: "1px solid rgba(0,0,0,0.08)",
          }} />
        ) : (
          <div style={{
            width: 160, height: 200, borderRadius: 14,
            background: `linear-gradient(135deg, rgba(${rgb}, 0.08) 0%, rgba(${rgb}, 0.18) 100%)`,
            border: "1px solid rgba(0,0,0,0.05)",
            display: "flex", alignItems: "center", justifyContent: "center",
            color, fontSize: 56, fontWeight: 800, letterSpacing: "-0.04em",
          }}>{initial}</div>
        )}
      </div>
      <div style={{ flex: "1 1 240px", minWidth: 240 }}>
        <div style={{
          display: "inline-block", padding: "3px 10px", borderRadius: 99,
          background: `rgba(${rgb}, 0.1)`, color,
          fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase",
          marginBottom: 10,
        }}>{item.title || "Instructor"}</div>
        <h3 style={{ fontSize: 26, fontWeight: 800, margin: "0 0 14px", letterSpacing: "-0.02em", color: "#0f172a" }}>
          {item.name}
        </h3>
        {item.bio && (
          <p style={{ fontSize: 14.5, lineHeight: 1.75, color: "#64748b", margin: "0 0 18px", whiteSpace: "pre-line" }}>
            {item.bio}
          </p>
        )}
        {item.experience && item.experience.length > 0 && (
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 6 }}>
            {item.experience.map((line, i) => (
              <li key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, color: "#475569", fontWeight: 500 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
                {line}
              </li>
            ))}
          </ul>
        )}
        {stats && stats.reportCount > 0 && (
          <div style={{ marginTop: 18, paddingTop: 14, borderTop: "1px solid rgba(0,0,0,0.06)", display: "flex", gap: 20, alignItems: "baseline" }}>
            <div>
              <div style={{ fontSize: 10, color: "#94a3b8", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 4 }}>통산 적중률</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 3 }}>
                <span style={{ fontSize: 24, fontWeight: 800, color, lineHeight: 1, letterSpacing: "-0.02em" }}>{Math.round(stats.avgHitRatePct)}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color, opacity: 0.85 }}>%</span>
              </div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: "#94a3b8", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 4 }}>누적 보고서</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 3 }}>
                <span style={{ fontSize: 24, fontWeight: 800, color: "#0f172a", lineHeight: 1, letterSpacing: "-0.02em" }}>{stats.reportCount}</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#64748b" }}>건</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
