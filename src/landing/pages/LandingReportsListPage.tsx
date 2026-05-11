// PATH: src/landing/pages/LandingReportsListPage.tsx
// 적중보고서 갤러리 — 학원장 picker 등록한 모든 보고서를 한 페이지로.
// nav "적중 사례 모두 보기" / 메인 hit_reports 섹션 하단 "더보기" 진입.
/* eslint-disable no-restricted-syntax */

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api, { type ApiRequestConfig } from "@/shared/api/axios";
import { fetchLandingPublic } from "../api";
import type { LandingPublicResponse, HitReportPublicCard, HitReportShowcaseItem } from "../types";
import { useResolvedLogo } from "../templates/shared";

export default function LandingReportsListPage() {
  const [landing, setLanding] = useState<LandingPublicResponse | null>(null);
  const [reports, setReports] = useState<HitReportPublicCard[]>([]);
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

  return (
    <div style={{ minHeight: "100vh", background: bg, color: textPrimary, fontFamily: "'Pretendard Variable', 'Pretendard', system-ui, sans-serif", letterSpacing: "-0.011em" }}>
      <ListNav cfg={cfg} gold={gold} cardBorder={cardBorder} textPrimary={textPrimary} />

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

      <section style={{ padding: "48px 24px 96px", background: bgAlt }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          {reports.length === 0 ? (
            <p style={{ fontSize: 14, color: textSecondary, textAlign: "center" }}>등록된 적중 보고서가 없습니다.</p>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 18 }}>
              {reports.map((r) => {
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
          )}
        </div>
      </section>
    </div>
  );
}

function ListNav({ cfg, gold, cardBorder, textPrimary }: { cfg: { brand_name: string; logo_url?: string }; gold: string; cardBorder: string; textPrimary: string }) {
  const logoUrl = useResolvedLogo(cfg as Parameters<typeof useResolvedLogo>[0], "nav");
  const initial = (cfg.brand_name || "").trim().charAt(0) || "•";
  return (
    <nav style={{ position: "sticky", top: 0, zIndex: 50, background: "rgba(10,14,26,0.85)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", borderBottom: `1px solid ${cardBorder}`, padding: "0 24px" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", height: 64, gap: 16 }}>
        <Link to="/landing" style={{ display: "flex", alignItems: "center", gap: 12, textDecoration: "none", color: textPrimary }}>
          {logoUrl
            ? <img src={logoUrl} alt={cfg.brand_name} style={{ height: 32, width: "auto", objectFit: "contain" }} />
            : <div style={{ width: 36, height: 36, borderRadius: 9, background: `linear-gradient(135deg, ${gold} 0%, #8B5E1F 100%)`, display: "flex", alignItems: "center", justifyContent: "center", color: "#0A0E1A", fontSize: 18, fontWeight: 800 }}>{initial}</div>}
          <span style={{ fontSize: 17, fontWeight: 800, letterSpacing: "-0.02em" }}>{cfg.brand_name}</span>
        </Link>
        <Link to="/landing" style={{ padding: "8px 16px", borderRadius: 8, background: "rgba(255,255,255,0.06)", color: textPrimary, border: `1px solid ${cardBorder}`, fontSize: 13, fontWeight: 600, textDecoration: "none" }}>← 홈으로</Link>
      </div>
    </nav>
  );
}
