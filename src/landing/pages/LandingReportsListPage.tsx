// PATH: src/landing/pages/LandingReportsListPage.tsx
// 적중보고서 갤러리 — 학원장 picker 등록한 모든 보고서를 한 페이지로.
// nav "적중 사례 모두 보기" / 메인 hit_reports 섹션 하단 "더보기" 진입.
/* eslint-disable no-restricted-syntax */

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api, { type ApiRequestConfig } from "@/shared/api/axios";
import { fetchLandingPublic } from "../api";
import type { LandingPublicResponse, HitReportPublicCard, HitReportShowcaseItem } from "../types";
import { LandingNavBar, type NavBarTokens } from "../templates/shared";
import LandingRoleFab from "../components/LandingRoleFab";
import LandingFooter, { FOOTER_TOKENS_DARK } from "../components/LandingFooter";

// Reports 페이지 nav 톤(PremiumDark 시그니처) — LandingNavBar tokens.
const REPORTS_NAV_TOKENS: NavBarTokens = {
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

function ReportsBrandMark({ name }: { name: string }) {
  const initial = (name || "").trim().charAt(0) || "•";
  return (
    <div style={{ width: 36, height: 36, borderRadius: 9, background: "linear-gradient(135deg, #D4A04C 0%, #8B5E1F 100%)", display: "flex", alignItems: "center", justifyContent: "center", color: "#0A0E1A", fontSize: 18, fontWeight: 800 }}>{initial}</div>
  );
}

export default function LandingReportsListPage() {
  const [landing, setLanding] = useState<LandingPublicResponse | null>(null);
  const [reports, setReports] = useState<HitReportPublicCard[]>([]);
  const [error, setError] = useState(false);
  // 가시성 강화 (2026-05-12 cycle 10): 검색 + 정렬
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"latest" | "rate" | "count">("latest");

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
    if (!ids.length) { setReports([]); return; }
    api.get("/matchup/landing/public/", { params: { ids: ids.join(",") }, skipAuth: true } as ApiRequestConfig)
      .then((r) => setReports(Array.isArray(r?.data?.reports) ? r.data.reports as HitReportPublicCard[] : []))
      .catch(() => setError(true));
  }, [landing]);

  // SEO
  useEffect(() => {
    if (!landing?.config) return;
    document.title = `적중 사례 — ${landing.config.brand_name}`;
    return () => { document.title = landing.config?.brand_name || "학원플러스"; };
  }, [landing]);

  if (error || (landing && !landing.config)) {
    return <div style={{ minHeight: "100vh", background: "#0A0E1A", color: "#9CA3AF", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>적중 보고서를 불러오지 못했습니다.</div>;
  }
  if (!landing) {
    return <div style={{ minHeight: "100vh", background: "#0A0E1A", display: "flex", alignItems: "center", justifyContent: "center" }}><div style={{ width: 36, height: 36, border: "3px solid rgba(255,255,255,0.15)", borderTopColor: "#D4A04C", borderRadius: "50%", animation: "spin 0.6s linear infinite" }} /><style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style></div>;
  }

  const cfg = landing.config!;
  const bg = "#0A0E1A";
  const bgAlt = "#0F1525";
  const cardBg = "rgba(255,255,255,0.04)";
  const cardBorder = "rgba(255,255,255,0.08)";
  const gold = "#D4A04C";
  const textPrimary = "#F5F1E8";
  const textSecondary = "#9CA3AF";

  // 통산 KPI
  const totalHit = reports.reduce((s, c) => s + c.hit_count, 0);
  const totalProb = reports.reduce((s, c) => s + c.total_problems, 0);
  const avgRate = totalProb > 0 ? Math.round((totalHit / totalProb) * 1000) / 10 : 0;

  // 검색 + 정렬 (inline 계산 — useMemo 제거로 React #310 잔존 결함 해소, 2026-05-12 cycle 14).
  // reports 갯수 적어 useMemo 효익 작음. 안정성 우선.
  const q = query.trim().toLowerCase();
  const filteredReports = (q
    ? reports.filter((r) => (r.doc_title || "").toLowerCase().includes(q) || (r.doc_category || "").toLowerCase().includes(q))
    : reports
  ).slice().sort((a, b) => {
    if (sort === "rate") return b.hit_rate_pct - a.hit_rate_pct;
    if (sort === "count") return b.hit_count - a.hit_count;
    const ad = a.submitted_at || a.created_at || "";
    const bd = b.submitted_at || b.created_at || "";
    return bd.localeCompare(ad);
  });

  return (
    <div style={{ minHeight: "100vh", background: bg, color: textPrimary, fontFamily: "'Pretendard Variable', 'Pretendard', system-ui, sans-serif", letterSpacing: "-0.011em" }}>
      <LandingNavBar
        config={cfg}
        sections={cfg.sections || []}
        tokens={REPORTS_NAV_TOKENS}
        brandMark={<ReportsBrandMark name={cfg.brand_name} />}
      />

      <section style={{ padding: "64px 24px 32px", borderBottom: `1px solid ${cardBorder}` }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: gold, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 14 }}>
            Hit Records · 적중 보고서 모음
          </div>
          <h1 style={{ fontSize: "clamp(28px, 3.5vw, 40px)", fontWeight: 800, margin: "0 0 14px", letterSpacing: "-0.025em", lineHeight: 1.25 }}>
            {cfg.brand_name}의 학교별 적중 사례
          </h1>
          <p style={{ fontSize: 16, color: textSecondary, margin: 0, lineHeight: 1.7, maxWidth: 640 }}>
            매주 학교별 기출변형 모의고사로 학교 시험을 정조준한 결과입니다. 카드를 누르면 시험지와 강의 자료를 비교한 본문 PDF가 열립니다.
          </p>
          {reports.length > 0 && (
            <div style={{ display: "flex", gap: 32, marginTop: 36, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: 11, color: textSecondary, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 4 }}>통산 적중률</div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                  <span style={{ fontSize: 40, fontWeight: 800, color: gold, lineHeight: 1, letterSpacing: "-0.03em" }}>{Math.round(avgRate)}</span>
                  <span style={{ fontSize: 18, fontWeight: 700, color: gold, opacity: 0.85 }}>%</span>
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: textSecondary, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 4 }}>누적 보고서</div>
                <div style={{ fontSize: 28, fontWeight: 800, color: textPrimary, letterSpacing: "-0.02em" }}>{reports.length} <span style={{ fontSize: 14, color: textSecondary, fontWeight: 600 }}>건</span></div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: textSecondary, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 4 }}>총 적중 / 전체 문항</div>
                <div style={{ fontSize: 28, fontWeight: 800, color: textPrimary, letterSpacing: "-0.02em" }}>
                  {totalHit} <span style={{ color: textSecondary, fontWeight: 600 }}>/ {totalProb}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      <section style={{ padding: "32px 24px 96px", background: bgAlt }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          {reports.length === 0 ? (
            <p style={{ fontSize: 14, color: textSecondary, textAlign: "center" }}>등록된 적중 보고서가 없습니다.</p>
          ) : (
            <>
            <ReportsToolbar query={query} setQuery={setQuery} sort={sort} setSort={setSort} gold={gold} textPrimary={textPrimary} textSecondary={textSecondary} cardBg={cardBg} cardBorder={cardBorder} />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 18 }}>
              {filteredReports.length === 0 ? null : filteredReports.map((r) => {
                const ratePct = Math.round(r.hit_rate_pct);
                const dateStr = (() => {
                  const raw = r.submitted_at || r.created_at;
                  if (!raw) return "";
                  try {
                    const d = new Date(raw);
                    return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,"0")}.${String(d.getDate()).padStart(2,"0")}`;
                  } catch { return ""; }
                })();
                return (
                  <Link
                    key={r.id}
                    to={`/landing/reports/${r.id}`}
                    style={{
                      padding: 24, borderRadius: 16,
                      background: cardBg, border: `1px solid ${cardBorder}`,
                      textDecoration: "none", color: textPrimary,
                      display: "flex", flexDirection: "column", gap: 12,
                      transition: "border-color 0.2s, transform 0.2s",
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.borderColor = "rgba(212,160,76,0.4)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.transform = "none"; e.currentTarget.style.borderColor = cardBorder; }}
                  >
                    <div style={{ fontSize: 11, color: textSecondary, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                      {r.doc_category || "적중 보고서"}
                    </div>
                    {r.doc_title && (
                      <div style={{ fontSize: 14.5, color: textPrimary, fontWeight: 600, letterSpacing: "-0.01em", lineHeight: 1.45 }}>
                        {r.doc_title}
                      </div>
                    )}
                    <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginTop: 4 }}>
                      <span style={{ fontSize: 36, fontWeight: 800, color: gold, lineHeight: 1, letterSpacing: "-0.03em" }}>{ratePct}</span>
                      <span style={{ fontSize: 16, fontWeight: 700, color: gold, opacity: 0.85 }}>%</span>
                      <span style={{ fontSize: 12, color: textSecondary, marginLeft: 6 }}>{r.hit_count} / {r.total_problems} 문항</span>
                    </div>
                    <div style={{ fontSize: 11, color: textSecondary, marginTop: 4, fontWeight: 600, letterSpacing: "0.04em", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span>자세히 보기 →</span>
                      {dateStr && <span style={{ opacity: 0.7 }}>📅 {dateStr}</span>}
                    </div>
                  </Link>
                );
              })}
            </div>
            {filteredReports.length === 0 && (
              <div style={{ padding: 40, textAlign: "center", color: textSecondary, fontSize: 13.5, background: cardBg, borderRadius: 14, border: `1px dashed ${cardBorder}`, marginTop: 8 }}>
                🔍 검색 결과가 없습니다. 다른 키워드로 시도해 보세요.
              </div>
            )}
            </>
          )}
        </div>
      </section>
      <LandingFooter config={cfg} sections={cfg.sections || []} tokens={FOOTER_TOKENS_DARK} />
      <LandingRoleFab />
    </div>
  );
}

function ReportsToolbar({ query, setQuery, sort, setSort, gold, textPrimary, textSecondary, cardBg, cardBorder }: {
  query: string; setQuery: (v: string) => void;
  sort: "latest" | "rate" | "count"; setSort: (v: "latest" | "rate" | "count") => void;
  gold: string; textPrimary: string; textSecondary: string; cardBg: string; cardBorder: string;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
      <div style={{ display: "flex", gap: 4 }}>
        <SortChip on={sort === "latest"} onClick={() => setSort("latest")} gold={gold} textPrimary={textPrimary} textSecondary={textSecondary}>최신순</SortChip>
        <SortChip on={sort === "rate"} onClick={() => setSort("rate")} gold={gold} textPrimary={textPrimary} textSecondary={textSecondary}>적중률 ↓</SortChip>
        <SortChip on={sort === "count"} onClick={() => setSort("count")} gold={gold} textPrimary={textPrimary} textSecondary={textSecondary}>적중 수 ↓</SortChip>
      </div>
      <div style={{ position: "relative", flex: "1 1 240px", maxWidth: 360 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2"
          style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}
        ><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="시험명·과목 검색"
          data-testid="landing-reports-search"
          style={{
            width: "100%", padding: "9px 12px 9px 34px", borderRadius: 999,
            border: `1px solid ${cardBorder}`, background: cardBg,
            color: textPrimary, fontSize: 13, fontFamily: "inherit", outline: "none",
          }}
        />
      </div>
    </div>
  );
}

function SortChip({ on, onClick, gold, textPrimary, textSecondary, children }: { on: boolean; onClick: () => void; gold: string; textPrimary: string; textSecondary: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "6px 12px", borderRadius: 999, border: "none",
        background: on ? `${gold}26` : "transparent",
        color: on ? textPrimary : textSecondary,
        fontSize: 12.5, fontWeight: on ? 700 : 600, cursor: "pointer", letterSpacing: "-0.01em",
      }}
    >{children}</button>
  );
}

