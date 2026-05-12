// PATH: src/landing/pages/LandingReportDetailPage.tsx
// 적중보고서 상세 — 학원장 picker 등록 보고서만 (backend 404 게이트).
// 학원 정체성 헤더(로고/브랜드명) + KPI 메타 + PDF iframe + 공유 버튼 + 다른 보고서 둘러보기.
//
// 학부모가 새 탭으로 사라지지 않고 사이트 내부 라우트 — 진짜 홈페이지 정체성 유지.
/* eslint-disable no-restricted-syntax */

import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api, { type ApiRequestConfig } from "@/shared/api/axios";
import { fetchLandingPublic } from "../api";
import type { LandingPublicResponse, HitReportPublicCard, HitReportShowcaseItem } from "../types";
import { LandingNavBar, type NavBarTokens } from "../templates/shared";
import LandingRoleFab from "../components/LandingRoleFab";
import LandingFooter, { FOOTER_TOKENS_DARK } from "../components/LandingFooter";
import PdfPageStack from "../components/PdfPageStack";
import { resolveTenantCode } from "@/shared/tenant";
import { setLandingMeta as setMeta } from "../utils/seoMeta";
import { fetchReviewsList, fetchReviewsSummary, type PublicReview, type ReviewsSummary } from "../api/publicCommunity";

// 적중보고서 상세 nav 톤(PremiumDark 시그니처) — List 페이지와 동일.
const DETAIL_NAV_TOKENS: NavBarTokens = {
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

function DetailBrandMark({ name }: { name: string }) {
  const initial = (name || "").trim().charAt(0) || "•";
  return (
    <div style={{ width: 36, height: 36, borderRadius: 9, background: "linear-gradient(135deg, #D4A04C 0%, #8B5E1F 100%)", display: "flex", alignItems: "center", justifyContent: "center", color: "#0A0E1A", fontSize: 18, fontWeight: 800, letterSpacing: "-0.02em" }}>{initial}</div>
  );
}

export default function LandingReportDetailPage() {
  const { reportId } = useParams<{ reportId: string }>();
  const [landing, setLanding] = useState<LandingPublicResponse | null>(null);
  const [report, setReport] = useState<HitReportPublicCard | null>(null);
  const [siblings, setSiblings] = useState<HitReportPublicCard[]>([]);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetchLandingPublic().then((d) => setLanding(d)).catch(() => setError(true));
  }, []);

  useEffect(() => {
    if (!landing?.config) return;
    const sections = landing.config.sections || [];
    const hit = sections.find((s) => s.type === "hit_reports" && s.enabled);
    if (!hit) { setError(true); return; }
    const ids = ((hit.items as HitReportShowcaseItem[] | undefined) || [])
      .map((it) => it.report_id).filter((n) => Number.isFinite(n));
    if (!ids.length) { setError(true); return; }
    api.get("/matchup/landing/public/", { params: { ids: ids.join(",") }, skipAuth: true } as ApiRequestConfig)
      .then((r) => {
        const reports = Array.isArray(r?.data?.reports) ? r.data.reports as HitReportPublicCard[] : [];
        const target = reports.find((c) => String(c.id) === String(reportId));
        if (!target) { setError(true); return; }
        setReport(target);
        setSiblings(reports.filter((c) => String(c.id) !== String(reportId)).slice(0, 3));
      })
      .catch(() => setError(true));
  }, [landing, reportId]);

  // SEO meta
  useEffect(() => {
    if (!landing?.config?.brand_name || !report) return;
    const ratePct = Math.round(report.hit_rate_pct);
    const subj = report.doc_category || report.doc_title;
    document.title = `${subj} ${ratePct}% 적중 — ${landing.config.brand_name}`;
    setMeta("description", `${landing.config.brand_name}의 ${subj} 적중 보고서 — ${report.hit_count}/${report.total_problems} 문항 (${ratePct}%).`);
    setMeta("og:title", document.title);
    setMeta("og:description", `${subj} 적중률 ${ratePct}% · 시험지 ↔ 강의 자료 비교 본문 PDF`);
    return () => { document.title = landing.config?.brand_name || "학원플러스"; };
  }, [landing, report]);

  if (error) {
    return (
      <div style={{ minHeight: "100vh", background: "#0A0E1A", color: "#F5F1E8", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 18, padding: 24, fontFamily: "'Pretendard Variable', 'Pretendard', system-ui, sans-serif" }}>
        <p style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>적중 보고서를 찾을 수 없습니다</p>
        <p style={{ fontSize: 14, color: "#9CA3AF", margin: 0 }}>이 보고서는 비공개 상태이거나 삭제되었습니다.</p>
        <Link to="/landing" style={{ marginTop: 12, padding: "10px 20px", borderRadius: 10, background: "#D4A04C", color: "#0A0E1A", fontWeight: 700, textDecoration: "none", fontSize: 14 }}>홈으로 돌아가기</Link>
      </div>
    );
  }

  if (!landing || !report) {
    return (
      <div style={{ minHeight: "100vh", background: "#0A0E1A", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 36, height: 36, border: "3px solid rgba(255,255,255,0.15)", borderTopColor: "#D4A04C", borderRadius: "50%", animation: "spin 0.6s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    );
  }

  const cfg = landing.config!;
  const ratePct = Math.round(report.hit_rate_pct);
  const subj = report.doc_category || report.doc_title;
  const apiBase = (import.meta.env.VITE_API_BASE_URL as string) || "";
  const tcRes = resolveTenantCode();
  const tcParam = tcRes.ok ? `?tenant=${encodeURIComponent(tcRes.code)}` : "";
  const pdfUrl = `${apiBase}/api/v1/matchup/landing/public/${report.id}/curated.pdf${tcParam}`;

  // 톤은 PremiumDark 시그니처 (template_key와 무관 — 보고서 detail은 통일된 다크 톤)
  const bg = "#0A0E1A";
  const bgAlt = "#0F1525";
  const cardBg = "rgba(255,255,255,0.04)";
  const cardBorder = "rgba(255,255,255,0.08)";
  const gold = "#D4A04C";
  const textPrimary = "#F5F1E8";
  const textSecondary = "#9CA3AF";

  const onShare = () => {
    const url = window.location.href;
    const title = `${subj} ${ratePct}% 적중 — ${cfg.brand_name}`;
    if (navigator.share) {
      navigator.share({ title, url }).catch(() => {});
    } else {
      navigator.clipboard.writeText(url).then(() => alert("링크가 복사되었습니다."));
    }
  };

  // 게시판 분위기 — 작성일 표시 (submitted_at 우선, fallback created_at).
  const dateStr = (() => {
    const raw = report.submitted_at || report.created_at;
    if (!raw) return "";
    try {
      const d = new Date(raw);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${y}.${m}.${day}`;
    } catch { return ""; }
  })();

  return (
    <div style={{ minHeight: "100vh", background: bg, color: textPrimary, fontFamily: "'Pretendard Variable', 'Pretendard', system-ui, sans-serif", letterSpacing: "-0.011em" }}>
      {/* 학원 헤더 — landing main과 통일된 NavBar(햄버거 + 모든 sections + role nav).
          학부모가 적중보고서 페이지에서도 다른 섹션(features/programs/contact)으로 cross-page 이동 가능.
          메뉴 누르면 /landing#sectionType으로 이동 + PublicLandingPage에서 hash → scroll. */}
      <LandingNavBar
        config={cfg}
        sections={cfg.sections || []}
        tokens={DETAIL_NAV_TOKENS}
        brandMark={<DetailBrandMark name={cfg.brand_name} />}
      />

      {/* 메타 헤더 */}
      <section style={{ padding: "48px 24px 24px", borderBottom: `1px solid ${cardBorder}` }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: gold, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 12 }}>
            Hit Report · 적중 보고서
          </div>
          <h1 style={{ fontSize: "clamp(24px, 3vw, 36px)", fontWeight: 800, margin: "0 0 12px", letterSpacing: "-0.025em", lineHeight: 1.25 }}>
            {report.doc_title || subj}
          </h1>
          {/* 게시판 분위기 — 작성일 메타. cafe.naver 스타일 (2026-05-11 학원장 요청). */}
          {(dateStr || (subj && report.doc_title && subj !== report.doc_title)) && (
            <div style={{ fontSize: 13, color: textSecondary, marginBottom: 16, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              {subj && report.doc_title && subj !== report.doc_title && <span>{subj}</span>}
              {subj && report.doc_title && subj !== report.doc_title && dateStr && <span style={{ opacity: 0.4 }}>·</span>}
              {dateStr && <span>📅 {dateStr}</span>}
            </div>
          )}
          <div style={{ display: "flex", gap: 28, alignItems: "baseline", flexWrap: "wrap", marginTop: 20 }}>
            <div>
              <div style={{ fontSize: 11, color: textSecondary, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 4 }}>적중률</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                <span style={{ fontSize: 48, fontWeight: 800, color: gold, lineHeight: 1, letterSpacing: "-0.03em" }}>{ratePct}</span>
                <span style={{ fontSize: 20, fontWeight: 700, color: gold, opacity: 0.85 }}>%</span>
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: textSecondary, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 4 }}>적중 / 전체</div>
              <div style={{ fontSize: 26, fontWeight: 800, color: textPrimary, letterSpacing: "-0.02em" }}>
                {report.hit_count} <span style={{ color: textSecondary, fontWeight: 600 }}>/ {report.total_problems}</span>
              </div>
            </div>
            <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
              <button
                type="button"
                onClick={onShare}
                style={{ padding: "10px 18px", borderRadius: 10, background: "rgba(255,255,255,0.06)", color: textPrimary, border: `1px solid ${cardBorder}`, cursor: "pointer", fontSize: 14, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 6 }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" /></svg>
                공유
              </button>
              <a
                href={pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{ padding: "10px 18px", borderRadius: 10, background: `linear-gradient(135deg, ${gold} 0%, #B8862F 100%)`, color: "#0A0E1A", textDecoration: "none", fontSize: 14, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 6 }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" /></svg>
                PDF 다운로드
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* PDF 페이지 stack — 부모 페이지 자연 scroll로 카페 게시물처럼 위→아래 읽기.
          학원장 spec(2026-05-12): "그냥 간단하게 쭉 스크롤하면서 읽을수있기를 바랬는데". */}
      <section style={{ padding: "32px 24px 16px", background: bgAlt }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <PdfPageStack
            pdfUrl={pdfUrl}
            maxWidth={1100}
            pageGap={16}
            textColor={textSecondary}
          />
          <p style={{ fontSize: 12, color: textSecondary, textAlign: "center", margin: "20px 0 0", lineHeight: 1.7 }}>
            좌:학교 시험지 문항 / 우:강의에서 다룬 자료. 페이지를 위에서 아래로 쭉 스크롤하며 읽을 수 있어요. PDF 원본은 우측 상단 "PDF 다운로드"로.
          </p>
        </div>
      </section>

      {/* 게시판 navigation — cafe 상세 페이지 하단 "목록 보기" 핵심 CTA (2026-05-11 학원장 요청).
          모바일 viewport 가독성 확보 위해 큰 button + 충분한 padding. */}
      <section style={{ padding: "32px 24px 12px", background: bgAlt, borderTop: `1px solid ${cardBorder}` }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "space-between", alignItems: "center" }}>
          <Link
            to="/landing/reports"
            data-testid="landing-report-list-link"
            style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              padding: "12px 22px", borderRadius: 10,
              background: "rgba(255,255,255,0.08)", color: textPrimary,
              border: `1px solid ${cardBorder}`,
              textDecoration: "none", fontSize: 14, fontWeight: 600,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" /></svg>
            적중 보고서 목록 보기
          </Link>
          <Link
            to="/landing"
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "10px 18px", borderRadius: 10,
              background: "transparent", color: textSecondary,
              border: `1px solid ${cardBorder}`,
              textDecoration: "none", fontSize: 13, fontWeight: 600,
            }}
          >
            ← 학원 홈으로
          </Link>
        </div>
      </section>

      {/* 관련 수강 후기 — Phase 3 매치업↔커뮤니티 cross-attach */}
      <RelatedReviewsBlock textPrimary={textPrimary} textSecondary={textSecondary} cardBg={cardBg} cardBorder={cardBorder} bgAlt={bgAlt} gold={gold} />

      {/* 다른 적중 사례 */}
      {siblings.length > 0 && (
        <section style={{ padding: "64px 24px 96px", background: bgAlt }}>
          <div style={{ maxWidth: 1200, margin: "0 auto" }}>
            <h2 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 24px", letterSpacing: "-0.02em" }}>다른 적중 사례</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
              {siblings.map((c) => {
                const r = Math.round(c.hit_rate_pct);
                return (
                  <Link
                    key={c.id}
                    to={`/landing/reports/${c.id}`}
                    style={{
                      padding: 24, borderRadius: 14, background: cardBg,
                      border: `1px solid ${cardBorder}`,
                      textDecoration: "none", color: textPrimary,
                      display: "flex", flexDirection: "column", gap: 10,
                    }}
                  >
                    <div style={{ fontSize: 11, color: textSecondary, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                      {c.doc_category || "적중 보고서"}
                    </div>
                    {c.doc_title && (
                      <div style={{ fontSize: 14, color: textPrimary, fontWeight: 600, letterSpacing: "-0.01em" }}>
                        {c.doc_title}
                      </div>
                    )}
                    <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginTop: 4 }}>
                      <span style={{ fontSize: 32, fontWeight: 800, color: gold, lineHeight: 1, letterSpacing: "-0.02em" }}>{r}</span>
                      <span style={{ fontSize: 14, fontWeight: 700, color: gold, opacity: 0.85 }}>%</span>
                      <span style={{ fontSize: 11, color: textSecondary, marginLeft: 4 }}>{c.hit_count} / {c.total_problems} 문항</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      )}
      <LandingFooter config={cfg} sections={cfg.sections || []} tokens={FOOTER_TOKENS_DARK} />
      <LandingRoleFab />
    </div>
  );
}

/** 적중보고서 상세 하단 — 학원의 최신 approved 후기 미니 카루셀 (사회적 증거 강화).
 *  fetchReviewsSummary로 평균 평점 KPI + 최근 후기 3건 노출. 0건이면 섹션 hide. */
function RelatedReviewsBlock({ textPrimary, textSecondary, cardBg, cardBorder, bgAlt, gold }: {
  textPrimary: string; textSecondary: string; cardBg: string; cardBorder: string; bgAlt: string; gold: string;
}) {
  const [reviews, setReviews] = useState<PublicReview[] | null>(null);
  const [summary, setSummary] = useState<ReviewsSummary | null>(null);

  useEffect(() => {
    fetchReviewsList({ page: 1, page_size: 3, ordering: "latest" })
      .then((r) => setReviews(r.results)).catch(() => setReviews([]));
    fetchReviewsSummary().then(setSummary).catch(() => setSummary(null));
  }, []);

  if (reviews !== null && reviews.length === 0 && (summary?.count ?? 0) === 0) return null;

  const stars = (n: number) => {
    const filled = "★★★★★".slice(0, Math.max(0, Math.min(5, n)));
    const dim = "★★★★★".slice(0, 5 - Math.max(0, Math.min(5, n)));
    return <span style={{ letterSpacing: 2 }}><span style={{ color: gold }}>{filled}</span><span style={{ color: "rgba(140,140,140,0.4)" }}>{dim}</span></span>;
  };

  return (
    <section style={{ padding: "64px 24px", background: bgAlt, borderTop: `1px solid ${cardBorder}` }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 24 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: gold, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>
              Reviews · 수강 후기
            </div>
            <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em", color: textPrimary }}>이 학원의 수강 후기</h2>
            {summary && summary.count > 0 && (
              <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 10, fontSize: 13.5, color: textSecondary }}>
                {stars(Math.round(summary.average))}
                <span style={{ color: textPrimary, fontWeight: 700 }}>{summary.average.toFixed(2)}</span>
                <span>·</span>
                <span>누적 {summary.count}건</span>
              </div>
            )}
          </div>
          <Link to="/landing/reviews" data-testid="related-reviews-more"
            style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 16px", borderRadius: 999, background: "transparent", border: `1px solid ${cardBorder}`, color: textSecondary, textDecoration: "none", fontSize: 13, fontWeight: 600, letterSpacing: "-0.01em" }}
          >후기 모두 보기 →</Link>
        </div>
        {reviews === null ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 14 }}>
            {[0, 1, 2].map((i) => <div key={i} style={{ height: 140, borderRadius: 14, background: cardBg, border: `1px solid ${cardBorder}` }} />)}
          </div>
        ) : reviews.length === 0 ? (
          <div style={{ padding: "28px 24px", borderRadius: 14, background: cardBg, border: `1px dashed ${cardBorder}`, textAlign: "center", color: textSecondary, fontSize: 13 }}>
            아직 등록된 수강 후기가 없습니다.
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
            {reviews.map((r) => (
              <Link key={r.id} to={`/landing/reviews/${r.id}`} data-testid={`related-review-${r.id}`}
                style={{
                  display: "flex", flexDirection: "column", gap: 8, padding: 18,
                  borderRadius: 14, border: `1px solid ${cardBorder}`, background: cardBg,
                  textDecoration: "none", color: textPrimary, transition: "border-color 0.15s",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = `${gold}66`; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = cardBorder; }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  {stars(r.rating)}
                  {r.is_verified && <span style={{ fontSize: 10, fontWeight: 700, color: gold, padding: "2px 8px", borderRadius: 999, background: `${gold}1F`, letterSpacing: "0.05em" }}>✓ 수강 인증</span>}
                </div>
                {r.title && <h3 style={{ margin: 0, fontSize: 14.5, fontWeight: 700, lineHeight: 1.4, letterSpacing: "-0.015em", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{r.title}</h3>}
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", fontSize: 11, color: textSecondary }}>
                  {r.grade && <span style={{ padding: "2px 8px", borderRadius: 999, background: "rgba(255,255,255,0.04)" }}>{r.grade}</span>}
                  {r.subject && <span style={{ padding: "2px 8px", borderRadius: 999, background: "rgba(255,255,255,0.04)" }}>{r.subject}</span>}
                </div>
                <div style={{ marginTop: "auto", fontSize: 11.5, color: textSecondary, display: "flex", justifyContent: "space-between" }}>
                  <span style={{ maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.display_name}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

