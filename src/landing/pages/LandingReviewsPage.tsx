// PATH: src/landing/pages/LandingReviewsPage.tsx
// 수강후기 list — 평점 ★ KPI band + 후기 카드 그리드.
// 외부 비로그인 학부모 read OK (approved만). 학생/학부모 로그인 → status=pending 작성.
/* eslint-disable no-restricted-syntax */

import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import useAuth from "@/auth/hooks/useAuth";
import { fetchLandingPublic } from "../api";
import {
  fetchReviewsList,
  fetchReviewsSummary,
  type Ordering,
  type PublicReview,
  type ReviewsSummary,
} from "../api/publicCommunity";
import type { LandingPublicResponse } from "../types";
import { LandingNavBar, type NavBarTokens } from "../templates/shared";
import LandingFooter, { FOOTER_TOKENS_DARK } from "../components/LandingFooter";
import LandingRoleFab from "../components/LandingRoleFab";
import { formatLandingCompactDate as formatDate } from "../utils/dateFormat";

const NAV_TOKENS: NavBarTokens = {
  bg: "rgba(10,14,26,0.85)",
  border: "rgba(255,255,255,0.08)",
  textPrimary: "#F5F1E8",
  textSecondary: "#9CA3AF",
  primaryColor: "#D4A04C",
  primaryRgb: "212,160,76",
  ctaGradient: "linear-gradient(135deg, #D4A04C 0%, #B8862F 100%)",
  ctaTextColor: "#0A0E1A",
  panelBg: "#0F1525",
};

const PAGE_SIZE = 12;

function BrandMark({ name }: { name: string }) {
  const initial = (name || "").trim().charAt(0) || "•";
  return (
    <div style={{
      width: 36, height: 36, borderRadius: 9,
      background: "linear-gradient(135deg, #D4A04C 0%, #8B5E1F 100%)",
      display: "flex", alignItems: "center", justifyContent: "center",
      color: "#0A0E1A", fontSize: 18, fontWeight: 800,
    }}>{initial}</div>
  );
}

export default function LandingReviewsPage() {
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const u = user as { tenantRole?: string | null; is_superuser?: boolean } | null;
  const role = (u?.tenantRole ?? "").toLowerCase();
  // 학생/학부모만 후기 작성 가능 (자작 차단 — staff은 불가)
  const canWrite = isAuthenticated && ["student", "parent"].includes(role);

  const [landing, setLanding] = useState<LandingPublicResponse | null>(null);
  const [summary, setSummary] = useState<ReviewsSummary | null>(null);
  const [ordering, setOrdering] = useState<Ordering>("latest");
  const [minRating, setMinRating] = useState<number | 0>(0);
  const [page, setPage] = useState(1);
  const [reviews, setReviews] = useState<PublicReview[] | null>(null);
  const [count, setCount] = useState(0);
  const [error, setError] = useState(false);

  useEffect(() => { fetchLandingPublic().then(setLanding).catch(() => setLanding(null)); }, []);
  useEffect(() => { fetchReviewsSummary().then(setSummary).catch(() => setSummary(null)); }, []);
  useEffect(() => { setPage(1); }, [ordering, minRating]);

  useEffect(() => {
    setReviews(null);
    setError(false);
    fetchReviewsList({ page, page_size: PAGE_SIZE, ordering, min_rating: minRating || undefined })
      .then((r) => { setReviews(r.results); setCount(r.count); })
      .catch(() => { setError(true); setReviews([]); setCount(0); });
  }, [page, ordering, minRating]);

  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));

  if (!landing?.config) {
    return (
      <div style={{ minHeight: "100vh", background: "#0A0E1A", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 36, height: 36, border: "3px solid rgba(255,255,255,0.15)", borderTopColor: "#D4A04C", borderRadius: "50%", animation: "spin 0.6s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    );
  }
  const cfg = landing.config;

  const bg = "#0A0E1A";
  const bgAlt = "#0F1525";
  const border = "rgba(255,255,255,0.08)";
  const cardBg = "rgba(255,255,255,0.03)";
  const textPrimary = "#F5F1E8";
  const textSecondary = "#9CA3AF";
  const textMuted = "#6B7280";
  const gold = "#D4A04C";

  return (
    <div style={{ minHeight: "100vh", background: bg, color: textPrimary, fontFamily: "'Pretendard Variable', 'Pretendard', system-ui, sans-serif", letterSpacing: "-0.011em" }}>
      <LandingNavBar config={cfg} sections={cfg.sections || []} tokens={NAV_TOKENS} brandMark={<BrandMark name={cfg.brand_name} />} />

      {/* 헤더 + KPI band */}
      <section style={{ padding: "56px 24px 32px", borderBottom: `1px solid ${border}` }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: gold, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>
            Reviews · 수강 후기
          </div>
          <h1 style={{ fontSize: "clamp(24px, 3vw, 34px)", fontWeight: 800, margin: 0, letterSpacing: "-0.025em", lineHeight: 1.25 }}>
            진짜 학원 가족이 남긴 수강 후기
          </h1>
          <p style={{ marginTop: 12, fontSize: 14, color: textSecondary, maxWidth: 640, lineHeight: 1.6 }}>
            학원 등록된 학생·학부모만 작성하며, 학원장 승인 후 외부에 공개됩니다. 평점·학년·과목 등 검증 메타가 함께 표시됩니다.
          </p>

          {summary && summary.count > 0 && (
            <div style={{ marginTop: 28, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16, maxWidth: 760 }}>
              <KpiCard label="평균 평점" value={summary.average.toFixed(2)} sub={renderStars(Math.round(summary.average), gold)} border={border} cardBg={cardBg} textPrimary={textPrimary} textSecondary={textSecondary} accent={gold} />
              <KpiCard label="누적 후기" value={`${summary.count}건`} border={border} cardBg={cardBg} textPrimary={textPrimary} textSecondary={textSecondary} accent={gold} />
              <DistributionCard distribution={summary.distribution} total={summary.count} border={border} cardBg={cardBg} textPrimary={textPrimary} textSecondary={textSecondary} accent={gold} />
            </div>
          )}
        </div>
      </section>

      {/* 정렬 + 별점 필터 */}
      <section style={{ background: bg, borderBottom: `1px solid ${border}`, position: "sticky", top: 64, zIndex: 30, backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "12px 24px", display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: 6 }}>
            {[
              { v: 0, label: "전체 별점" },
              { v: 5, label: "★ 5" },
              { v: 4, label: "★ 4+" },
              { v: 3, label: "★ 3+" },
            ].map((opt) => {
              const on = opt.v === minRating;
              return (
                <button key={opt.v} type="button" onClick={() => setMinRating(opt.v)}
                  data-testid={`landing-reviews-rating-${opt.v}`}
                  style={{
                    padding: "7px 14px", border: `1px solid ${on ? gold : border}`, borderRadius: 999, cursor: "pointer",
                    background: on ? gold : "transparent", color: on ? "#0A0E1A" : textSecondary,
                    fontSize: 12.5, fontWeight: on ? 700 : 600, letterSpacing: "-0.01em",
                  }}
                >{opt.label}</button>
              );
            })}
          </div>
          <select
            value={ordering}
            onChange={(e) => setOrdering(e.target.value as Ordering)}
            data-testid="landing-reviews-ordering"
            style={{
              padding: "7px 10px", borderRadius: 8, border: `1px solid ${border}`,
              background: cardBg, color: textPrimary, fontSize: 12.5, fontWeight: 600,
              outline: "none", cursor: "pointer",
            }}
          >
            <option value="latest">최신순</option>
            <option value="rating">별점순</option>
            <option value="likes">좋아요순</option>
          </select>
          <div style={{ flex: 1 }} />
          {canWrite ? (
            <button type="button" onClick={() => navigate("/landing/reviews/write")} data-testid="landing-reviews-write-cta"
              style={{ padding: "9px 16px", borderRadius: 999, border: "none", background: gold, color: "#0A0E1A", fontSize: 13, fontWeight: 700, cursor: "pointer", letterSpacing: "-0.01em" }}
            >후기 작성</button>
          ) : isAuthenticated ? (
            <span style={{ fontSize: 12, color: textMuted }}>* 후기는 학생·학부모만 작성 가능</span>
          ) : (
            <Link to="/login" data-testid="landing-reviews-login-cta"
              style={{ padding: "9px 16px", borderRadius: 999, background: "transparent", color: textPrimary, border: `1px solid ${border}`, textDecoration: "none", fontSize: 12.5, fontWeight: 600, letterSpacing: "-0.01em" }}
            >로그인 후 작성 →</Link>
          )}
        </div>
      </section>

      {/* 본문 */}
      <section style={{ padding: "32px 24px 64px", background: bgAlt, minHeight: "60vh" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          {reviews === null && !error ? (
            <SkeletonGrid border={border} cardBg={cardBg} />
          ) : !reviews || reviews.length === 0 ? (
            <FirstReviewInvite canWrite={canWrite} onWrite={() => navigate("/landing/reviews/write")} border={border} cardBg={cardBg} accent={gold} textPrimary={textPrimary} textSecondary={textSecondary} />
          ) : (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
                {reviews.map((r) => <ReviewCard key={r.id} review={r} border={border} cardBg={cardBg} accent={gold} textPrimary={textPrimary} textMuted={textMuted} />)}
              </div>
              <Pagination page={page} totalPages={totalPages} onChange={setPage} accent={gold} textPrimary={textPrimary} textSecondary={textSecondary} border={border} />
            </>
          )}
        </div>
      </section>

      <LandingFooter config={cfg} sections={cfg.sections || []} tokens={FOOTER_TOKENS_DARK} />
      <LandingRoleFab />
    </div>
  );
}

function KpiCard({ label, value, sub, border, cardBg, textPrimary, textSecondary, accent }: {
  label: string; value: string; sub?: React.ReactNode;
  border: string; cardBg: string; textPrimary: string; textSecondary: string; accent: string;
}) {
  return (
    <div style={{ padding: "20px 22px", borderRadius: 14, background: cardBg, border: `1px solid ${border}` }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: accent, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 800, color: textPrimary, letterSpacing: "-0.02em" }}>{value}</div>
      {sub && <div style={{ marginTop: 6, fontSize: 13, color: textSecondary }}>{sub}</div>}
    </div>
  );
}

function DistributionCard({ distribution, total, border, cardBg, textPrimary, textSecondary, accent }: {
  distribution: Record<string, number>; total: number; border: string; cardBg: string;
  textPrimary: string; textSecondary: string; accent: string;
}) {
  const rows = [5, 4, 3, 2, 1];
  return (
    <div style={{ padding: "16px 22px", borderRadius: 14, background: cardBg, border: `1px solid ${border}`, gridColumn: "span 2 / auto", minWidth: 0 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: accent, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>별점 분포</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {rows.map((r) => {
          const c = distribution[String(r)] ?? 0;
          const pct = total > 0 ? Math.round((c / total) * 100) : 0;
          return (
            <div key={r} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: textSecondary }}>
              <span style={{ width: 32, color: textPrimary, fontWeight: 700 }}>★ {r}</span>
              <div style={{ flex: 1, height: 8, background: "rgba(255,255,255,0.06)", borderRadius: 999, overflow: "hidden" }}>
                <div style={{ width: `${pct}%`, height: "100%", background: accent, borderRadius: 999 }} />
              </div>
              <span style={{ width: 36, textAlign: "right" }}>{c}건</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function renderStars(n: number, gold: string): React.ReactNode {
  const stars = "★★★★★".slice(0, Math.max(0, Math.min(5, n)));
  const dim = "★★★★★".slice(0, 5 - Math.max(0, Math.min(5, n)));
  return (
    <span style={{ letterSpacing: 2 }}>
      <span style={{ color: gold }}>{stars}</span>
      <span style={{ color: "rgba(255,255,255,0.18)" }}>{dim}</span>
    </span>
  );
}

function ReviewCard({ review, border, cardBg, accent, textPrimary, textMuted }: {
  review: PublicReview; border: string; cardBg: string; accent: string;
  textPrimary: string; textMuted: string;
}) {
  return (
    <Link to={`/landing/reviews/${review.id}`} data-testid={`landing-review-card-${review.id}`}
      style={{
        display: "flex", flexDirection: "column", gap: 10, padding: 20,
        borderRadius: 16, border: `1px solid ${border}`, background: cardBg,
        textDecoration: "none", color: textPrimary,
        transition: "border-color 0.15s, transform 0.15s",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = `${accent}66`; e.currentTarget.style.transform = "translateY(-2px)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = border; e.currentTarget.style.transform = "translateY(0)"; }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <div>{renderStars(review.rating, accent)}</div>
        {review.is_verified && (
          <span style={{ fontSize: 10, fontWeight: 700, color: accent, letterSpacing: "0.05em", padding: "3px 8px", borderRadius: 999, background: `${accent}1F` }}>
            ✓ 수강 인증
          </span>
        )}
      </div>
      {review.title && (
        <h3 style={{ margin: 0, fontSize: 15.5, fontWeight: 700, letterSpacing: "-0.015em", lineHeight: 1.4 }}>{review.title}</h3>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", fontSize: 11.5, color: textMuted }}>
        {review.grade && <span style={{ padding: "2px 8px", borderRadius: 999, background: "rgba(255,255,255,0.04)" }}>{review.grade}</span>}
        {review.subject && <span style={{ padding: "2px 8px", borderRadius: 999, background: "rgba(255,255,255,0.04)" }}>{review.subject}</span>}
        {review.enrollment_months > 0 && <span style={{ padding: "2px 8px", borderRadius: 999, background: "rgba(255,255,255,0.04)" }}>수강 {review.enrollment_months}개월</span>}
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: "auto", fontSize: 12, color: textMuted, paddingTop: 6 }}>
        <span style={{ maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{review.display_name}</span>
        <span style={{ display: "flex", gap: 10 }}>
          {review.like_count > 0 && <span style={{ color: accent, fontWeight: 700 }}>♥ {review.like_count}</span>}
          {review.reply_count > 0 && <span>💬 {review.reply_count}</span>}
          <span>{formatDate(review.created_at)}</span>
        </span>
      </div>
    </Link>
  );
}

function Pagination({ page, totalPages, onChange, accent, textPrimary, textSecondary, border }: {
  page: number; totalPages: number; onChange: (p: number) => void;
  accent: string; textPrimary: string; textSecondary: string; border: string;
}) {
  const windowSize = 10;
  const windowStart = Math.floor((page - 1) / windowSize) * windowSize + 1;
  const windowEnd = Math.min(windowStart + windowSize - 1, totalPages);
  const pages = useMemo(() => {
    const arr: number[] = [];
    for (let i = windowStart; i <= windowEnd; i++) arr.push(i);
    return arr;
  }, [windowStart, windowEnd]);
  if (totalPages <= 1) return null;
  const goto = (p: number) => {
    if (p < 1 || p > totalPages || p === page) return;
    onChange(p);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const btn: React.CSSProperties = {
    minWidth: 36, height: 36, borderRadius: 8, padding: "0 10px",
    border: `1px solid ${border}`, background: "transparent",
    cursor: "pointer", fontSize: 13, fontWeight: 600, letterSpacing: "-0.01em",
  };
  return (
    <nav data-testid="landing-reviews-pagination" style={{ marginTop: 28, display: "flex", justifyContent: "center", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
      <button type="button" onClick={() => goto(windowStart - 1)} disabled={windowStart === 1}
        style={{ ...btn, color: textSecondary, opacity: windowStart === 1 ? 0.35 : 1 }}>‹</button>
      {pages.map((p) => {
        const on = p === page;
        return (
          <button key={p} type="button" onClick={() => goto(p)} data-testid={`landing-reviews-page-${p}`}
            style={{ ...btn, color: on ? "#0A0E1A" : textPrimary, background: on ? accent : "transparent", border: on ? `1px solid ${accent}` : `1px solid ${border}`, fontWeight: on ? 700 : 600 }}
          >{p}</button>
        );
      })}
      <button type="button" onClick={() => goto(windowEnd + 1)} disabled={windowEnd === totalPages}
        style={{ ...btn, color: textSecondary, opacity: windowEnd === totalPages ? 0.35 : 1 }}>›</button>
    </nav>
  );
}

function FirstReviewInvite({ canWrite, onWrite, border, cardBg, accent, textPrimary, textSecondary }: {
  canWrite: boolean; onWrite: () => void; border: string; cardBg: string; accent: string; textPrimary: string; textSecondary: string;
}) {
  return (
    <div style={{ padding: "72px 24px", borderRadius: 14, background: cardBg, border: `1px dashed ${border}`, textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
      <div style={{ fontSize: 42 }}>★</div>
      <p style={{ margin: 0, fontSize: 17, fontWeight: 700, color: textPrimary, letterSpacing: "-0.01em" }}>아직 등록된 후기가 없습니다</p>
      <p style={{ margin: 0, fontSize: 13.5, color: textSecondary, lineHeight: 1.6, maxWidth: 460 }}>
        {canWrite
          ? "첫 후기의 주인공이 되어 보세요. 외부 학부모의 결정을 도와줄 수 있습니다."
          : "학원 가족이 새 후기를 등록하면 여기에서 가장 먼저 만나실 수 있습니다."}
      </p>
      {canWrite && (
        <button type="button" onClick={onWrite} data-testid="landing-reviews-empty-write-cta"
          style={{ marginTop: 4, padding: "11px 22px", borderRadius: 999, border: "none", background: accent, color: "#0A0E1A", fontSize: 14, fontWeight: 700, cursor: "pointer", letterSpacing: "-0.01em" }}
        >첫 후기를 작성해 보세요 →</button>
      )}
    </div>
  );
}

function SkeletonGrid({ border, cardBg }: { border: string; cardBg: string }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} style={{ padding: 20, borderRadius: 16, background: cardBg, border: `1px solid ${border}`, display: "flex", flexDirection: "column", gap: 10, height: 180 }}>
          <div style={{ height: 16, width: 100, borderRadius: 4, background: "rgba(255,255,255,0.06)" }} />
          <div style={{ height: 18, width: "80%", borderRadius: 4, background: "linear-gradient(90deg, rgba(255,255,255,0.04), rgba(255,255,255,0.10), rgba(255,255,255,0.04))", backgroundSize: "200% 100%", animation: "lrSkel 1.4s ease-in-out infinite" }} />
          <div style={{ display: "flex", gap: 6 }}>
            <div style={{ height: 14, width: 50, borderRadius: 999, background: "rgba(255,255,255,0.04)" }} />
            <div style={{ height: 14, width: 50, borderRadius: 999, background: "rgba(255,255,255,0.04)" }} />
          </div>
        </div>
      ))}
      <style>{`@keyframes lrSkel { 0% { background-position: 0% 50% } 100% { background-position: -200% 50% } }`}</style>
    </div>
  );
}
