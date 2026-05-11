// PATH: src/landing/components/TestimonialsSticky.tsx
// 수강 후기 sticky cards — hero 직후 학원장 신뢰감 강화용 후기 카드 row.
//
// 학원장 spec(2026-05-11 추가 cycle): testimonials section 외에 hero 근처에서도
// 후기 미리보기. nexon dnfm 메인 페이지의 promotional banner row 차용.
//
// 데이터: usePublicTestimonials() — 학원장 승인된 후기. 상위 3개만.
/* eslint-disable no-restricted-syntax */

import { Link } from "react-router-dom";
import { usePublicTestimonials } from "../templates/shared";

interface StickyTokens {
  bg: string;
  cardBg: string;
  border: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  accent: string;
  accentSoft: string;
}

const DARK: StickyTokens = {
  bg: "#0A0E1A",
  cardBg: "rgba(255,255,255,0.03)",
  border: "rgba(255,255,255,0.08)",
  textPrimary: "#F5F1E8",
  textSecondary: "#9CA3AF",
  textMuted: "#6B7280",
  accent: "#D4A04C",
  accentSoft: "rgba(212,160,76,0.10)",
};

const LIGHT: StickyTokens = {
  bg: "#FFFFFF",
  cardBg: "#F8FAFC",
  border: "rgba(15,23,42,0.08)",
  textPrimary: "#0F172A",
  textSecondary: "#475569",
  textMuted: "#94A3B8",
  accent: "#2563EB",
  accentSoft: "rgba(37,99,235,0.06)",
};

export default function TestimonialsSticky({ theme = "dark" }: { theme?: "dark" | "light" }) {
  const list = usePublicTestimonials();
  const top3 = list.slice(0, 3);
  if (top3.length === 0) return null;
  const t = theme === "dark" ? DARK : LIGHT;

  return (
    <section
      data-stype="testimonials_sticky"
      style={{
        background: t.bg,
        padding: "0 24px 48px",
        fontFamily: "'Pretendard Variable', 'Pretendard', system-ui, sans-serif",
      }}
    >
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div style={{
          display: "flex", alignItems: "flex-end", justifyContent: "space-between",
          marginBottom: 14, flexWrap: "wrap", gap: 8,
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: t.accent, letterSpacing: "0.1em", textTransform: "uppercase" }}>
            Voices · 학부모·학생 후기
          </div>
          <Link
            to="/landing#testimonials"
            data-testid="landing-testimonials-sticky-more"
            style={{ fontSize: 12, fontWeight: 600, color: t.textSecondary, textDecoration: "none" }}
          >전체 후기 →</Link>
        </div>

        <div style={{
          display: "grid",
          gridTemplateColumns: top3.length === 1 ? "1fr" : top3.length === 2 ? "1fr 1fr" : "repeat(3, 1fr)",
          gap: 14,
        }}>
          {top3.map((tm) => (
            <article
              key={tm.id}
              style={{
                padding: "20px 22px",
                borderRadius: 14,
                background: t.cardBg,
                border: `1px solid ${t.border}`,
                display: "flex", flexDirection: "column", gap: 12,
                minHeight: 120,
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill={t.accent} opacity={0.45}>
                <path d="M3 21c3 0 7-1 7-8V5c0-1.25-.75-2-2-2H4c-1.25 0-2 .75-2 2v6c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2H2v4h1zm12 0c3 0 7-1 7-8V5c0-1.25-.75-2-2-2h-4c-1.25 0-2 .75-2 2v6c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2h-1v4h1z" />
              </svg>
              <p style={{
                fontSize: 14, lineHeight: 1.65, color: t.textPrimary, margin: 0,
                display: "-webkit-box", WebkitLineClamp: 4, WebkitBoxOrient: "vertical",
                overflow: "hidden", textOverflow: "ellipsis",
                letterSpacing: "-0.01em",
              }}>
                {tm.text}
              </p>
              <div style={{ marginTop: "auto", display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                <span style={{ color: t.textPrimary, fontWeight: 700 }}>{tm.name}</span>
                {tm.role && <span style={{ color: t.textMuted }}>· {tm.role}</span>}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
