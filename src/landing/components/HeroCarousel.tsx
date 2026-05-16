// PATH: src/landing/components/HeroCarousel.tsx
// 히어로 직후 자동 회전 캐러셀.
//
// Phase A(2026-05-11): hit_reports section.items만 활용 (매치업 적중보고서 회전).
// Phase B(#63 2026-05-12): hero_carousel section.items 지원 — hit_report + custom 카드 mix.
//   학원장이 LandingEditor에서 자유 mix: 매치업 보고서 / 공지·이벤트 custom 카드.
//
// 동작: 자동 슬라이드(5s) + 좌/우 버튼 + dot pagination + hover/focus 일시정지 + ←→ 키.
// 데이터 0이면 컴포넌트 null. slides 1개면 컨트롤 숨김.
/* eslint-disable no-restricted-syntax */

import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import api, { type ApiRequestConfig } from "@/shared/api/axios";
import type { HitReportPublicCard, HitReportShowcaseItem, HeroCarouselItem } from "../types";
import { fetchPublicHitReportsCached, normalizeHitReportIds } from "../api/hitReports";

const AUTOPLAY_MS = 5000;

interface NormalizedSlide {
  key: string;
  kind: "hit_report" | "custom";
  category: string;
  title: string;
  subtitle?: string;
  ratePct?: number;
  ratioLabel?: string;
  dateLabel?: string;
  ctaLabel: string;
  ctaLink: string;
  ctaInternal: boolean;
  image?: string;
}

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

function formatDate(raw: string | null | undefined): string {
  if (!raw) return "";
  try {
    const d = new Date(raw);
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
  } catch { return ""; }
}

export default function HeroCarousel({ items, carouselItems, theme = "dark" }: {
  items?: HitReportShowcaseItem[];
  /** Phase B(#63 2026-05-12): hero_carousel section.items — hit_report + custom mix. carouselItems 우선. */
  carouselItems?: HeroCarouselItem[];
  theme?: "dark" | "light";
}) {
  const t = theme === "dark" ? DARK_TOKENS : LIGHT_TOKENS;
  const [hitCards, setHitCards] = useState<HitReportPublicCard[] | null>(null);
  interface PostCard { id: number; title: string; post_type: string; category_label?: string | null; published_at?: string | null; created_at?: string | null; preview_image?: string | null }
  const [postCards, setPostCards] = useState<PostCard[] | null>(null);
  const [error, setError] = useState(false);
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // 소스 결정 — carouselItems 우선, 없으면 items(hit_report호환) fallback.
  const sourceItems: HeroCarouselItem[] = useMemo(() => {
    if (carouselItems && carouselItems.length > 0) return carouselItems;
    return (items || []).map((it) => ({ kind: "hit_report" as const, report_id: it.report_id }));
  }, [carouselItems, items]);

  // hit_report fetch
  const hitIds = useMemo(() => (
    normalizeHitReportIds(
      sourceItems
        .filter((it) => it.kind === "hit_report")
        .map((it) => it.report_id)
        .filter((n): n is number => Number.isFinite(n)),
    )
  ), [sourceItems]);
  const idsKey = hitIds.join(",");

  useEffect(() => {
    if (!hitIds.length) { setHitCards([]); return; }
    setHitCards(null); setError(false);
    fetchPublicHitReportsCached(hitIds)
      .then((list) => setHitCards(list))
      .catch(() => { setError(true); setHitCards([]); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey]);

  // post kind fetch (#64 P1)
  const postIds = useMemo(() => (
    sourceItems
      .filter((it) => it.kind === "post")
      .map((it) => it.post_id)
      .filter((n): n is number => Number.isFinite(n))
  ), [sourceItems]);
  const postIdsKey = postIds.slice().sort((a, b) => a - b).join(",");
  useEffect(() => {
    if (!postIds.length) { setPostCards([]); return; }
    setPostCards(null);
    api.get("/community/landing/public-posts/", { params: { ids: postIdsKey }, skipAuth: true } as ApiRequestConfig)
      .then((r) => {
        const list: PostCard[] = Array.isArray(r?.data?.posts) ? r.data.posts : [];
        setPostCards(list);
      })
      .catch(() => setPostCards([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postIdsKey]);

  // normalize slides (hitCards 또는 postCards가 fetch 중이면 placeholder 안 그림 — 아래 loading guard)
  const slides: NormalizedSlide[] = useMemo(() => {
    if (hitCards === null || postCards === null) return [];
    return sourceItems.map((it, i): NormalizedSlide | null => {
      if (it.kind === "hit_report") {
        const card = hitCards.find((c) => c.id === it.report_id);
        if (!card) return null;
        return {
          key: `hit-${card.id}`,
          kind: "hit_report",
          category: card.doc_category || "적중 보고서",
          title: card.doc_title || card.doc_category || "적중 보고서",
          ratePct: Math.round(card.hit_rate_pct),
          ratioLabel: `${card.hit_count} / ${card.total_problems} 문항 적중`,
          dateLabel: formatDate(card.submitted_at || card.created_at),
          ctaLabel: "보고서 본문 보기",
          ctaLink: `/landing/reports/${card.id}`,
          ctaInternal: true,
        };
      }
      if (it.kind === "post") {
        const p = postCards.find((pp) => pp.id === it.post_id);
        if (!p) return null;
        return {
          key: `post-${p.id}`,
          kind: "custom",
          category: p.category_label || (p.post_type === "notice" ? "공지" : "게시글"),
          title: p.title || "",
          dateLabel: formatDate(p.published_at || p.created_at),
          ctaLabel: "자세히 보기",
          ctaLink: `/landing/community/${p.post_type}/posts/${p.id}`,
          ctaInternal: true,
          image: p.preview_image || undefined,
        };
      }
      if (it.kind === "custom") {
        if (!it.title && !it.subtitle && !it.image_url) return null;
        const link = (it.cta_link || "").trim();
        const isInternal = link.startsWith("/");
        return {
          key: `custom-${i}`,
          kind: "custom",
          category: it.category || "공지",
          title: it.title || "",
          subtitle: it.subtitle || "",
          ctaLabel: it.cta_label || "자세히 보기",
          ctaLink: link || "/landing",
          ctaInternal: isInternal,
          image: it.image_url || undefined,
        };
      }
      return null;
    }).filter((s): s is NormalizedSlide => s !== null);
  }, [sourceItems, hitCards, postCards]);

  // autoplay
  useEffect(() => {
    if (slides.length <= 1 || paused) return;
    const id = window.setTimeout(() => setIdx((i) => (i + 1) % slides.length), AUTOPLAY_MS);
    return () => window.clearTimeout(id);
  }, [slides, idx, paused]);

  // 키보드 ←→
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onKey = (e: KeyboardEvent) => {
      if (slides.length <= 1) return;
      if (e.key === "ArrowLeft") setIdx((i) => (i - 1 + slides.length) % slides.length);
      if (e.key === "ArrowRight") setIdx((i) => (i + 1) % slides.length);
    };
    el.addEventListener("keydown", onKey);
    return () => el.removeEventListener("keydown", onKey);
  }, [slides]);

  // 로딩 skeleton
  if (sourceItems.length > 0 && ((hitIds.length > 0 && hitCards === null) || (postIds.length > 0 && postCards === null))) {
    return (
      <section data-stype="hero_carousel" style={{ background: t.bg, padding: "0 24px 32px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", height: 220, borderRadius: 18, border: `1px solid ${t.border}`, background: t.cardBg, opacity: 0.5, animation: "heroCarSkel 1.4s ease-in-out infinite" }} />
        <style>{`@keyframes heroCarSkel { 0%, 100% { opacity: 0.4 } 50% { opacity: 0.7 } }`}</style>
      </section>
    );
  }
  if (error || slides.length === 0) return null;

  const current = slides[idx % slides.length];
  const isMatchupCarousel = slides.every((s) => s.kind === "hit_report");
  const labelText = isMatchupCarousel ? "Matchup · 매치업 적중 보고서" : "Spotlight · 학원장 강조";

  const goPrev = () => setIdx((i) => (i - 1 + slides.length) % slides.length);
  const goNext = () => setIdx((i) => (i + 1) % slides.length);

  const cardInner = (
    <div style={{ display: "grid", gridTemplateColumns: current.kind === "hit_report" ? "1fr auto" : "1fr", gap: 28, alignItems: "center", minHeight: 160 }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: t.accent, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 12 }}>
          {current.category}
        </div>
        <h3 style={{
          fontSize: "clamp(20px, 2.4vw, 28px)", fontWeight: 800,
          color: t.textPrimary, letterSpacing: "-0.025em", lineHeight: 1.3,
          margin: "0 0 14px",
          display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
          overflow: "hidden", textOverflow: "ellipsis",
        }}>{current.title}</h3>
        {(current.ratioLabel || current.dateLabel || current.subtitle) && (
          <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 13.5, color: t.textSecondary, flexWrap: "wrap" }}>
            {current.subtitle && <span>{current.subtitle}</span>}
            {current.ratioLabel && <span><strong style={{ color: t.textPrimary }}>{current.ratioLabel}</strong></span>}
            {current.ratioLabel && current.dateLabel && <span style={{ opacity: 0.5 }}>·</span>}
            {current.dateLabel && <span>{current.dateLabel}</span>}
          </div>
        )}
        <div style={{ marginTop: 22, display: "inline-flex", alignItems: "center", gap: 6,
          padding: "10px 20px", borderRadius: 999,
          background: t.ctaBg, color: t.ctaText,
          fontSize: 13.5, fontWeight: 700, letterSpacing: "-0.01em",
        }}>
          {current.ctaLabel}
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12,5 19,12 12,19" /></svg>
        </div>
      </div>
      {current.kind === "hit_report" && typeof current.ratePct === "number" && (
        <div style={{ textAlign: "center", padding: "14px 24px", borderRadius: 16, background: t.accentSoft, border: `1px solid ${t.border}` }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: t.accent, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 6 }}>적중률</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 2, justifyContent: "center" }}>
            <span style={{ fontSize: "clamp(48px, 6vw, 72px)", fontWeight: 800, color: t.accent, lineHeight: 1, letterSpacing: "-0.04em" }}>{current.ratePct}</span>
            <span style={{ fontSize: 22, fontWeight: 700, color: t.accent, opacity: 0.9 }}>%</span>
          </div>
        </div>
      )}
    </div>
  );

  const cardStyle: React.CSSProperties = {
    display: "block",
    position: "relative",
    padding: "36px 36px 32px",
    borderRadius: 18,
    background: current.image
      ? `linear-gradient(135deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.35) 100%), url(${current.image}) center/cover no-repeat`
      : t.cardBg,
    border: `1px solid ${t.border}`,
    textDecoration: "none",
    color: t.textPrimary,
    overflow: "hidden",
    transition: "border-color 0.2s, transform 0.2s",
    boxShadow: theme === "dark" ? "0 12px 40px rgba(0,0,0,0.35)" : "0 8px 24px rgba(15,23,42,0.08)",
  };

  return (
    <section
      ref={containerRef}
      data-stype="hero_carousel"
      tabIndex={0}
      role="region"
      aria-label={labelText}
      data-testid="landing-hero-carousel"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      style={{ background: t.bg, padding: "0 24px 48px", outline: "none" }}
    >
      <div style={{ maxWidth: 1200, margin: "0 auto", position: "relative" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: t.accent, letterSpacing: "0.1em", textTransform: "uppercase" }}>{labelText}</span>
            <span style={{ fontSize: 11, color: t.textMuted, fontWeight: 600 }}>{idx + 1} / {slides.length}</span>
          </div>
          {isMatchupCarousel && (
            <Link to="/landing/reports" data-testid="landing-hero-carousel-all"
              style={{ fontSize: 12, fontWeight: 600, color: t.textSecondary, textDecoration: "none", letterSpacing: "-0.01em" }}
            >전체 보기 →</Link>
          )}
        </div>

        {current.ctaInternal ? (
          <Link to={current.ctaLink} data-testid={`landing-hero-carousel-card-${current.key}`} style={cardStyle}>{cardInner}</Link>
        ) : (
          <a href={current.ctaLink} data-testid={`landing-hero-carousel-card-${current.key}`} target="_blank" rel="noopener noreferrer" style={cardStyle}>{cardInner}</a>
        )}

        {slides.length > 1 && (
          <>
            <div style={{ position: "absolute", top: "calc(50% + 26px)", left: -10, transform: "translateY(-50%)", display: "flex", alignItems: "center", pointerEvents: "none" }}>
              <button type="button" onClick={(e) => { e.preventDefault(); goPrev(); }} aria-label="이전" data-testid="landing-hero-carousel-prev"
                style={{ pointerEvents: "auto", width: 40, height: 40, borderRadius: "50%",
                  background: theme === "dark" ? "rgba(10,14,26,0.85)" : "#FFFFFF",
                  border: `1px solid ${t.border}`, color: t.textPrimary, cursor: "pointer",
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  boxShadow: "0 6px 16px rgba(0,0,0,0.18)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><polyline points="15,18 9,12 15,6" /></svg>
              </button>
            </div>
            <div style={{ position: "absolute", top: "calc(50% + 26px)", right: -10, transform: "translateY(-50%)", display: "flex", alignItems: "center", pointerEvents: "none" }}>
              <button type="button" onClick={(e) => { e.preventDefault(); goNext(); }} aria-label="다음" data-testid="landing-hero-carousel-next"
                style={{ pointerEvents: "auto", width: 40, height: 40, borderRadius: "50%",
                  background: theme === "dark" ? "rgba(10,14,26,0.85)" : "#FFFFFF",
                  border: `1px solid ${t.border}`, color: t.textPrimary, cursor: "pointer",
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  boxShadow: "0 6px 16px rgba(0,0,0,0.18)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><polyline points="9,18 15,12 9,6" /></svg>
              </button>
            </div>
            <div style={{ marginTop: 18, display: "flex", justifyContent: "center", gap: 8 }}>
              {slides.map((s, i) => {
                const on = i === idx;
                return (
                  <button key={s.key} type="button" onClick={() => setIdx(i)}
                    aria-label={`${i + 1}번째로 이동`} data-testid={`landing-hero-carousel-dot-${i}`}
                    style={{ width: on ? 24 : 8, height: 8, borderRadius: 999,
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
