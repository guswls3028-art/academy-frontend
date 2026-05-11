// PATH: src/landing/components/HeroCarousel.tsx
// 히어로 직후 자동 회전 캐러셀 — 학원장 요청(2026-05-11): 매치업 적중보고서가 히어로에 떠야.
//
// 데이터 소스: 학원장이 LandingEditor에서 hit_reports section.items에 picker로 등록한 보고서.
// 추가 조작 없이 기존 데이터 재활용 → 학원장이 보고서 등록하면 자동으로 hero에 노출.
//
// 동작: 자동 슬라이드(5s) + 좌/우 버튼 + dot pagination + hover 일시정지 + ARIA roles.
// 슬라이드 1개일 땐 컨트롤 숨김(노이즈 방지). 데이터 없으면 컴포넌트 자체 null.
/* eslint-disable no-restricted-syntax */

import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import api, { type ApiRequestConfig } from "@/shared/api/axios";
import type { HitReportPublicCard, HitReportShowcaseItem } from "../types";

const AUTOPLAY_MS = 5000;

interface CarouselTokens {
  bg: string;
  cardBg: string;
  border: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  accent: string;
  accentSoft: string;
  ctaBg: string;
  ctaText: string;
}

const DARK_TOKENS: CarouselTokens = {
  bg: "#0A0E1A",
  cardBg: "linear-gradient(135deg, rgba(212,160,76,0.10) 0%, rgba(212,160,76,0.04) 50%, rgba(255,255,255,0.02) 100%)",
  border: "rgba(212,160,76,0.25)",
  textPrimary: "#F5F1E8",
  textSecondary: "#9CA3AF",
  textMuted: "#6B7280",
  accent: "#D4A04C",
  accentSoft: "rgba(212,160,76,0.12)",
  ctaBg: "linear-gradient(135deg, #D4A04C 0%, #B8862F 100%)",
  ctaText: "#0A0E1A",
};

const LIGHT_TOKENS: CarouselTokens = {
  bg: "#F8FAFC",
  cardBg: "linear-gradient(135deg, rgba(37,99,235,0.04) 0%, rgba(37,99,235,0.02) 60%, #FFFFFF 100%)",
  border: "rgba(37,99,235,0.18)",
  textPrimary: "#0F172A",
  textSecondary: "#475569",
  textMuted: "#94A3B8",
  accent: "#2563EB",
  accentSoft: "rgba(37,99,235,0.08)",
  ctaBg: "linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)",
  ctaText: "#FFFFFF",
};

export default function HeroCarousel({ items, theme = "dark" }: {
  items: HitReportShowcaseItem[] | undefined;
  theme?: "dark" | "light";
}) {
  const t = theme === "dark" ? DARK_TOKENS : LIGHT_TOKENS;
  const [cards, setCards] = useState<HitReportPublicCard[] | null>(null);
  const [error, setError] = useState(false);
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // ids 추출 → backend public endpoint fetch
  const ids = (items || [])
    .map((it) => it.report_id)
    .filter((n): n is number => Number.isFinite(n));
  const idsKey = ids.slice().sort((a, b) => a - b).join(",");

  useEffect(() => {
    if (!ids.length) { setCards([]); return; }
    setCards(null); setError(false);
    api.get("/matchup/landing/public/", { params: { ids: idsKey }, skipAuth: true } as ApiRequestConfig)
      .then((r) => {
        const list: HitReportPublicCard[] = Array.isArray(r?.data?.reports) ? r.data.reports : [];
        setCards(list);
      })
      .catch(() => { setError(true); setCards([]); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey]);

  // autoplay
  useEffect(() => {
    if (!cards || cards.length <= 1 || paused) return;
    const id = window.setTimeout(() => setIdx((i) => (i + 1) % cards.length), AUTOPLAY_MS);
    return () => window.clearTimeout(id);
  }, [cards, idx, paused]);

  // 키보드 navigation (포커스 시)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onKey = (e: KeyboardEvent) => {
      if (!cards || cards.length <= 1) return;
      if (e.key === "ArrowLeft") { setIdx((i) => (i - 1 + cards.length) % cards.length); }
      if (e.key === "ArrowRight") { setIdx((i) => (i + 1) % cards.length); }
    };
    el.addEventListener("keydown", onKey);
    return () => el.removeEventListener("keydown", onKey);
  }, [cards]);

  // 데이터 없거나 에러면 노출 안 함 (hero section만 그대로)
  if (cards === null) {
    return (
      <section data-stype="hero_carousel" style={{ background: t.bg, padding: "0 24px 32px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", height: 220, borderRadius: 18, border: `1px solid ${t.border}`, background: t.cardBg, opacity: 0.5, animation: "heroCarSkel 1.4s ease-in-out infinite" }} />
        <style>{`@keyframes heroCarSkel { 0%, 100% { opacity: 0.4 } 50% { opacity: 0.7 } }`}</style>
      </section>
    );
  }
  if (error || !cards.length) return null;

  const current = cards[idx % cards.length];
  const ratePct = Math.round(current.hit_rate_pct);
  const subj = current.doc_category || current.doc_title;

  const goPrev = () => setIdx((i) => (i - 1 + cards.length) % cards.length);
  const goNext = () => setIdx((i) => (i + 1) % cards.length);

  return (
    <section
      ref={containerRef}
      data-stype="hero_carousel"
      tabIndex={0}
      role="region"
      aria-label="매치업 적중 보고서 캐러셀"
      data-testid="landing-hero-carousel"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      style={{
        background: t.bg,
        padding: "0 24px 48px",
        outline: "none",
      }}
    >
      <div style={{ maxWidth: 1200, margin: "0 auto", position: "relative" }}>
        {/* 카테고리 라벨 */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          marginBottom: 14, flexWrap: "wrap", gap: 8,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: t.accent, letterSpacing: "0.1em", textTransform: "uppercase" }}>
              Matchup · 매치업 적중 보고서
            </span>
            <span style={{ fontSize: 11, color: t.textMuted, fontWeight: 600 }}>
              {idx + 1} / {cards.length}
            </span>
          </div>
          <Link
            to="/landing/reports"
            data-testid="landing-hero-carousel-all"
            style={{ fontSize: 12, fontWeight: 600, color: t.textSecondary, textDecoration: "none", letterSpacing: "-0.01em" }}
          >전체 보기 →</Link>
        </div>

        {/* 캐러셀 카드 */}
        <Link
          to={`/landing/reports/${current.id}`}
          data-testid={`landing-hero-carousel-card-${current.id}`}
          style={{
            display: "block",
            position: "relative",
            padding: "36px 36px 32px",
            borderRadius: 18,
            background: t.cardBg,
            border: `1px solid ${t.border}`,
            textDecoration: "none",
            color: t.textPrimary,
            overflow: "hidden",
            transition: "border-color 0.2s, transform 0.2s",
            boxShadow: theme === "dark" ? "0 12px 40px rgba(0,0,0,0.35)" : "0 8px 24px rgba(15,23,42,0.08)",
          }}
        >
          {/* 좌측 콘텐츠 / 우측 큰 KPI */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 28, alignItems: "center", minHeight: 160 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: t.accent, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 12 }}>
                {current.doc_category || "적중 보고서"}
              </div>
              <h3 style={{
                fontSize: "clamp(20px, 2.4vw, 28px)", fontWeight: 800,
                color: t.textPrimary, letterSpacing: "-0.025em", lineHeight: 1.3,
                margin: "0 0 14px",
                display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
                overflow: "hidden", textOverflow: "ellipsis",
              }}>{current.doc_title || subj}</h3>
              <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 13.5, color: t.textSecondary, flexWrap: "wrap" }}>
                <span><strong style={{ color: t.textPrimary }}>{current.hit_count}</strong> / {current.total_problems} 문항 적중</span>
                {(current.submitted_at || current.created_at) && (
                  <>
                    <span style={{ opacity: 0.5 }}>·</span>
                    <span>{formatDate(current.submitted_at || current.created_at)}</span>
                  </>
                )}
              </div>
              <div style={{ marginTop: 22, display: "inline-flex", alignItems: "center", gap: 6,
                padding: "10px 20px", borderRadius: 999,
                background: t.ctaBg, color: t.ctaText,
                fontSize: 13.5, fontWeight: 700, letterSpacing: "-0.01em",
              }}>
                보고서 본문 보기
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12,5 19,12 12,19" /></svg>
              </div>
            </div>
            {/* 큰 KPI: 적중률 % */}
            <div style={{ textAlign: "center", padding: "14px 24px", borderRadius: 16, background: t.accentSoft, border: `1px solid ${t.border}` }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: t.accent, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 6 }}>적중률</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 2, justifyContent: "center" }}>
                <span style={{ fontSize: "clamp(48px, 6vw, 72px)", fontWeight: 800, color: t.accent, lineHeight: 1, letterSpacing: "-0.04em" }}>
                  {ratePct}
                </span>
                <span style={{ fontSize: 22, fontWeight: 700, color: t.accent, opacity: 0.9 }}>%</span>
              </div>
            </div>
          </div>
        </Link>

        {/* 컨트롤 — 좌/우 화살표 + dots */}
        {cards.length > 1 && (
          <>
            <div style={{ position: "absolute", top: "calc(50% + 26px)", left: -10, transform: "translateY(-50%)", display: "flex", alignItems: "center", pointerEvents: "none" }}>
              <button
                type="button"
                onClick={(e) => { e.preventDefault(); goPrev(); }}
                aria-label="이전 보고서"
                data-testid="landing-hero-carousel-prev"
                style={{
                  pointerEvents: "auto",
                  width: 40, height: 40, borderRadius: "50%",
                  background: theme === "dark" ? "rgba(10,14,26,0.85)" : "#FFFFFF",
                  border: `1px solid ${t.border}`, color: t.textPrimary,
                  cursor: "pointer",
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  boxShadow: "0 6px 16px rgba(0,0,0,0.18)",
                  backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><polyline points="15,18 9,12 15,6" /></svg>
              </button>
            </div>
            <div style={{ position: "absolute", top: "calc(50% + 26px)", right: -10, transform: "translateY(-50%)", display: "flex", alignItems: "center", pointerEvents: "none" }}>
              <button
                type="button"
                onClick={(e) => { e.preventDefault(); goNext(); }}
                aria-label="다음 보고서"
                data-testid="landing-hero-carousel-next"
                style={{
                  pointerEvents: "auto",
                  width: 40, height: 40, borderRadius: "50%",
                  background: theme === "dark" ? "rgba(10,14,26,0.85)" : "#FFFFFF",
                  border: `1px solid ${t.border}`, color: t.textPrimary,
                  cursor: "pointer",
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  boxShadow: "0 6px 16px rgba(0,0,0,0.18)",
                  backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><polyline points="9,18 15,12 9,6" /></svg>
              </button>
            </div>
            {/* dot pagination */}
            <div style={{ marginTop: 18, display: "flex", justifyContent: "center", gap: 8 }}>
              {cards.map((c, i) => {
                const on = i === idx;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setIdx(i)}
                    aria-label={`${i + 1}번째 보고서로 이동`}
                    data-testid={`landing-hero-carousel-dot-${i}`}
                    style={{
                      width: on ? 24 : 8, height: 8, borderRadius: 999,
                      background: on ? t.accent : t.border,
                      border: "none", cursor: "pointer", padding: 0,
                      transition: "width 0.2s, background 0.2s",
                    }}
                  />
                );
              })}
            </div>
          </>
        )}
      </div>
    </section>
  );
}

function formatDate(raw: string | null | undefined): string {
  if (!raw) return "";
  try {
    const d = new Date(raw);
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
  } catch { return ""; }
}
