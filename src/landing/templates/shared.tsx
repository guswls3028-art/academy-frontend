// PATH: src/app_admin/domains/landing/templates/shared.tsx
// 공통 렌더링 유틸. 모든 템플릿에서 사용.
//
// 랜딩 템플릿 도메인 — inline style 면제 + 기존 시그니처 호환 (color/borderColor 등 일부 unused 파라미터).
/* eslint-disable no-restricted-syntax, @typescript-eslint/no-unused-vars, react-refresh/only-export-components, react-hooks/exhaustive-deps */

import type { LandingConfig, LandingSection, FeatureItem, TestimonialItem, ProgramItem, FaqItem, HitReportShowcaseItem, HitReportPublicCard } from "../types";
import { useState, useEffect } from "react";

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

/** 공개 적중보고서 카드 — 학원장이 골라서 노출하는 마케팅 KPI 카드.
 *
 * - 데이터: GET /api/v1/matchup/landing/public/?ids=... (인증 X, subdomain → tenant 격리)
 * - 디자인: 카드 그리드. KPI 숫자(적중률 + 적중수/총수)만 강조. 본문/PDF/이미지는 노출 안 함.
 * - 학원장이 보고서를 게시 안 했거나 ID 비어있으면 카드 자체 안 그림.
 * - SSR fetch 실패해도 placeholder만 그리고 끝남(랜딩 깨지면 안 됨).
 */
export function HitReportCards({ items, color, rgb, theme = "light" }: { items: HitReportShowcaseItem[]; color: string; rgb: string; theme?: "light" | "dark" }) {
  const [cards, setCards] = useState<HitReportPublicCard[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const ids = (items || []).map((it) => it.report_id).filter((n) => Number.isFinite(n));
    if (!ids.length) {
      setCards([]);
      return;
    }
    const url = `/api/v1/matchup/landing/public/?ids=${ids.join(",")}`;
    fetch(url, { credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((data) => setCards(Array.isArray(data?.reports) ? data.reports : []))
      .catch(() => setError(true));
  }, [JSON.stringify((items || []).map((it) => it.report_id))]);

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

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20 }}>
      {cards.map((card) => {
        const label = labelMap.get(card.id) || card.doc_category || card.doc_title;
        const sub = card.doc_title && card.doc_title !== label ? card.doc_title : "";
        const ratePct = Math.round(card.hit_rate_pct);
        return (
          <div
            key={card.id}
            style={{
              padding: 28,
              borderRadius: 18,
              background: cardBg,
              border: `1px solid ${cardBorder}`,
              boxShadow: cardShadow,
              display: "flex",
              flexDirection: "column",
              gap: 14,
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 700, color: labelColor, letterSpacing: "0.06em", textTransform: "uppercase" }}>
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
          </div>
        );
      })}
    </div>
  );
}
