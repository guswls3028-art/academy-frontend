// PATH: src/landing/pages/LandingShareReportPage.tsx
// 1클릭 공유 토큰 진입 페이지 (#67, 2026-05-12).
// 학원장 spec: 선생이 학생/학부모에게 카톡으로 링크만 보내면, 학생은 별도 로그인이나
// 학원 가입 없이 클릭 한 번으로 적중보고서 본문 PDF 즉시 확인.
//
// URL: /landing/share/:token
// Backend: GET /matchup/share/<uuid:token>/        → 메타
//          GET /matchup/share/<uuid:token>/curated.pdf → PDF (iframe)
// 토큰만으로 통과 — 학원장 picker 등록 무관. 학원장이 회전/취소하면 즉시 차단.
/* eslint-disable no-restricted-syntax */

import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api, { type ApiRequestConfig } from "@/shared/api/axios";
import { feedback } from "@/shared/ui/feedback/feedback";
import { fetchLandingPublic } from "../api";
import type { LandingPublicResponse } from "../types";
import { LandingNavBar, type NavBarTokens } from "../templates/shared";
import LandingFooter, { FOOTER_TOKENS_DARK } from "../components/LandingFooter";
import LandingRoleFab from "../components/LandingRoleFab";
import { setLandingMeta } from "../utils/seoMeta";
import { fetchPublicHitReportsCached } from "../api/hitReports";

const SHARE_NAV_TOKENS: NavBarTokens = {
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

function ShareBrandMark({ name }: { name: string }) {
  const initial = (name || "").trim().charAt(0) || "•";
  return (
    <div style={{ width: 36, height: 36, borderRadius: 9, background: "linear-gradient(135deg, #D4A04C 0%, #8B5E1F 100%)", display: "flex", alignItems: "center", justifyContent: "center", color: "#0A0E1A", fontSize: 18, fontWeight: 800, letterSpacing: "-0.02em" }}>{initial}</div>
  );
}

type OtherCard = {
  id: number;
  doc_title: string;
  doc_category: string;
  hit_count: number;
  total_problems: number;
  hit_rate_pct: number;
};

type ShareMeta = {
  id: number;
  title: string;
  doc_title: string;
  doc_category: string;
  hit_count: number;
  total_problems: number;
  hit_rate_pct: number;
  author_name: string;
  submitted_at: string | null;
  created_at: string | null;
  tenant_name: string;
  tenant_code: string;
  pdf_url: string;
  // 다른 보고서 — backend가 카드 메타 inline (1 round-trip 최적화 #67 cycle 9, 2026-05-12).
  // legacy other_report_ids는 호환 위해 유지하되 신규 코드는 other_reports 사용.
  other_reports?: OtherCard[];
  other_report_ids?: number[];
};

export default function LandingShareReportPage() {
  const { token } = useParams<{ token: string }>();
  const [meta, setMeta] = useState<ShareMeta | null>(null);
  const [landing, setLanding] = useState<LandingPublicResponse | null>(null);
  const [error, setError] = useState(false);
  const [others, setOthers] = useState<OtherCard[]>([]);

  useEffect(() => {
    if (!token) { setError(true); return; }
    api.get<ShareMeta>(`/matchup/share/${token}/`, { skipAuth: true } as ApiRequestConfig)
      .then((r) => setMeta(r.data))
      .catch(() => setError(true));
  }, [token]);

  // landing config — tenant branding (logo/brand_name/sections nav). 실패해도 share 자체는 노출 가능.
  useEffect(() => { fetchLandingPublic().then(setLanding).catch(() => setLanding(null)); }, []);

  // 다른 보고서 카드 — backend inline 응답 우선 사용 (#67 cycle 9 latency 1 round-trip).
  // legacy other_report_ids fallback fetch: backend 미배포 시 호환 위해 유지.
  useEffect(() => {
    if (!meta) { setOthers([]); return; }
    // 신규 backend: other_reports 이미 카드 메타 inline.
    if (Array.isArray(meta.other_reports) && meta.other_reports.length > 0) {
      setOthers(meta.other_reports.slice(0, 6));
      return;
    }
    // legacy: ids만 있고 카드 없음 → 별도 fetch (점진적 deprecate).
    if (!meta.other_report_ids?.length) { setOthers([]); return; }
    const ids = meta.other_report_ids.slice(0, 6);
    fetchPublicHitReportsCached(ids)
      .then((reports) => setOthers(reports))
      .catch(() => setOthers([]));
  }, [meta]);

  // SEO — 카톡 미리보기 og:title
  useEffect(() => {
    if (!meta) return;
    const ratePct = Math.round(meta.hit_rate_pct);
    const subj = meta.doc_category || meta.doc_title;
    const brand = meta.tenant_name || landing?.config?.brand_name || "학원";
    document.title = `${subj} ${ratePct}% 적중 — ${brand}`;
    setLandingMeta("description", `${brand}의 ${subj} 적중 보고서 — ${meta.hit_count}/${meta.total_problems} 문항 (${ratePct}%).`);
    setLandingMeta("og:title", document.title);
    setLandingMeta("og:description", `${subj} 적중률 ${ratePct}% · 시험지 ↔ 강의 자료 비교 본문 PDF`);
    return () => { document.title = brand; };
  }, [meta, landing]);

  if (error) {
    return (
      <div style={{ minHeight: "100vh", background: "#0A0E1A", color: "#F5F1E8", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 18, padding: 24, fontFamily: "'Pretendard Variable', 'Pretendard', system-ui, sans-serif" }}>
        <p style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>공유 링크를 찾을 수 없습니다</p>
        <p style={{ fontSize: 14, color: "#9CA3AF", margin: 0, textAlign: "center", lineHeight: 1.6 }}>
          이 링크는 만료되었거나 비공개로 전환되었습니다.<br />
          선생님께 새 링크를 요청해 주세요.
        </p>
        <Link to="/landing" style={{ marginTop: 12, padding: "10px 20px", borderRadius: 10, background: "#D4A04C", color: "#0A0E1A", fontWeight: 700, textDecoration: "none", fontSize: 14 }}>학원 홈으로</Link>
      </div>
    );
  }

  if (!meta) {
    return (
      <div style={{ minHeight: "100vh", background: "#0A0E1A", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 36, height: 36, border: "3px solid rgba(255,255,255,0.15)", borderTopColor: "#D4A04C", borderRadius: "50%", animation: "spin 0.6s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    );
  }

  const ratePct = Math.round(meta.hit_rate_pct);
  const subj = meta.doc_category || meta.doc_title;
  const apiBase = (import.meta.env.VITE_API_BASE_URL as string) || "";
  const pdfUrl = `${apiBase}/api/v1${meta.pdf_url.replace(/^\/api\/v1/, "")}`;
  // 위 보정: meta.pdf_url 은 `/api/v1/matchup/share/<token>/curated.pdf` 형태로 backend 가 박아둠.
  // apiBase 가 host 만 있을 수도 / `/api/v1` 까지 포함할 수도 있어서 중복 prefix 제거.

  const bg = "#0A0E1A";
  const bgAlt = "#0F1525";
  const cardBorder = "rgba(255,255,255,0.08)";
  const gold = "#D4A04C";
  const textPrimary = "#F5F1E8";
  const textSecondary = "#9CA3AF";

  const brandName = meta.tenant_name || landing?.config?.brand_name || "학원";

  // 작성일 — submitted_at 우선
  const dateStr = (() => {
    const raw = meta.submitted_at || meta.created_at;
    if (!raw) return "";
    try {
      const d = new Date(raw);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${y}.${m}.${day}`;
    } catch { return ""; }
  })();

  const onShare = () => {
    const url = window.location.href;
    const title = `${subj} ${ratePct}% 적중 — ${brandName}`;
    if (navigator.share) {
      navigator.share({ title, url }).catch(() => {});
    } else {
      navigator.clipboard.writeText(url)
        .then(() => feedback.success("링크가 복사되었습니다. 카톡에 붙여넣으면 됩니다."))
        .catch(() => feedback.info(url));
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: bg, color: textPrimary, fontFamily: "'Pretendard Variable', 'Pretendard', system-ui, sans-serif", letterSpacing: "-0.011em" }}>
      {landing?.config && (
        <LandingNavBar
          config={landing.config}
          sections={landing.config.sections || []}
          tokens={SHARE_NAV_TOKENS}
          brandMark={<ShareBrandMark name={landing.config.brand_name || brandName} />}
        />
      )}

      {/* 카톡 진입 첫 인상 — "이건 진짜 학원 자료" 신뢰 + 핵심 메트릭. */}
      <section style={{ padding: "48px 24px 24px", borderBottom: `1px solid ${cardBorder}` }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: gold, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 12 }}>
            Hit Report · {brandName}
          </div>
          <h1 style={{ fontSize: "clamp(24px, 3vw, 36px)", fontWeight: 800, margin: "0 0 12px", letterSpacing: "-0.025em", lineHeight: 1.25 }}>
            {meta.doc_title || subj}
          </h1>
          {(dateStr || meta.author_name || (subj && meta.doc_title && subj !== meta.doc_title)) && (
            <div style={{ fontSize: 13, color: textSecondary, marginBottom: 16, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              {subj && meta.doc_title && subj !== meta.doc_title && <span>{subj}</span>}
              {meta.author_name && <span>👤 {meta.author_name}</span>}
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
                {meta.hit_count} <span style={{ color: textSecondary, fontWeight: 600 }}>/ {meta.total_problems}</span>
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

      {/* PDF 본문 — 적중 자료 1건 이상일 때만 노출. 0건이면 학생 혼란 방지 fallback. */}
      <section style={{ padding: "32px 24px", background: bgAlt }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          {meta.hit_count > 0 ? (
            <>
              <div style={{ borderRadius: 16, overflow: "hidden", border: `1px solid ${cardBorder}`, background: "#fff", height: "min(85vh, 1100px)", boxShadow: "0 20px 60px rgba(0,0,0,0.5)" }}>
                <iframe
                  src={`${pdfUrl}#zoom=page-fit`}
                  title={`${subj} 적중 보고서`}
                  style={{ width: "100%", height: "100%", border: "none" }}
                />
              </div>
              <p style={{ fontSize: 12, color: textSecondary, textAlign: "center", margin: "16px 0 0", lineHeight: 1.7 }}>
                좌:학교 시험지 문항 / 우:강의에서 다룬 자료. 모바일에서 PDF가 잘 안 보이면 우측 상단 PDF 다운로드를 누르세요.
              </p>
            </>
          ) : (
            // 적중 자료 0건 — 강사가 본문 매칭 자료를 아직 등록하지 않은 상태.
            // PDF iframe 띄우면 흰 화면 (cover만 있는 빈 PDF) → 학생이 "왜 빈 페이지?" 혼란.
            // 명시 메시지로 상태 안내. CTA로 학원 다른 적중사례 둘러보기 권유.
            <div
              data-testid="share-empty-content"
              style={{
                borderRadius: 16, padding: "64px 32px",
                border: `1px dashed ${cardBorder}`,
                background: "rgba(255,255,255,0.03)",
                textAlign: "center",
                display: "flex", flexDirection: "column", alignItems: "center", gap: 14,
              }}
            >
              <div style={{
                width: 56, height: 56, borderRadius: 14,
                background: `rgba(${(meta.tenant_code ? "212,160,76" : "212,160,76")}, 0.12)`,
                display: "flex", alignItems: "center", justifyContent: "center",
                color: gold,
              }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /></svg>
              </div>
              <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: textPrimary, letterSpacing: "-0.01em" }}>
                강사가 본문 자료를 아직 등록하지 않았어요
              </h3>
              <p style={{ fontSize: 13, color: textSecondary, margin: 0, lineHeight: 1.7, maxWidth: 480 }}>
                이 시험지에 매칭되는 강의 자료가 등록되면 본문 PDF가 여기에 노출됩니다.<br />
                강사에게 본문 등록을 요청하거나, 아래 학원 홈페이지에서 다른 적중 사례를 둘러보세요.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* 학원 정체성 CTA — "이 자료가 마음에 들면 학원 홈을 둘러보세요" */}
      <section style={{ padding: "32px 24px 24px", background: bgAlt, borderTop: `1px solid ${cardBorder}` }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center", alignItems: "center" }}>
          <Link
            to="/landing"
            style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              padding: "12px 22px", borderRadius: 10,
              background: gold, color: "#0A0E1A",
              textDecoration: "none", fontSize: 14, fontWeight: 700,
            }}
          >
            {brandName} 홈페이지 →
          </Link>
          <Link
            to="/landing/reports"
            style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              padding: "12px 22px", borderRadius: 10,
              background: "rgba(255,255,255,0.08)", color: textPrimary,
              border: `1px solid ${cardBorder}`,
              textDecoration: "none", fontSize: 14, fontWeight: 600,
            }}
          >
            다른 적중 보고서 둘러보기
          </Link>
        </div>
      </section>

      {/* 다른 보고서 carousel — meta.other_report_ids 기반. 학생이 한 링크 들어와도 학원 카탈로그 자연 노출. */}
      {others.length > 0 && (
        <section style={{ padding: "32px 24px 96px", background: bgAlt }}>
          <div style={{ maxWidth: 1200, margin: "0 auto" }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 16px", letterSpacing: "-0.02em", color: textPrimary }}>
              {brandName}의 다른 적중 사례
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14 }}>
              {others.map((c) => {
                const r = Math.round(c.hit_rate_pct);
                return (
                  <Link
                    key={c.id}
                    to={`/landing/reports/${c.id}`}
                    style={{
                      padding: 20, borderRadius: 14,
                      background: "rgba(255,255,255,0.04)",
                      border: `1px solid ${cardBorder}`,
                      textDecoration: "none", color: textPrimary,
                      display: "flex", flexDirection: "column", gap: 8,
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
                      <span style={{ fontSize: 28, fontWeight: 800, color: gold, lineHeight: 1, letterSpacing: "-0.02em" }}>{r}</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: gold, opacity: 0.85 }}>%</span>
                      <span style={{ fontSize: 11, color: textSecondary, marginLeft: 4 }}>{c.hit_count} / {c.total_problems} 문항</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {landing?.config && (
        <LandingFooter config={landing.config} sections={landing.config.sections || []} tokens={FOOTER_TOKENS_DARK} />
      )}
      <LandingRoleFab />
    </div>
  );
}
