// PATH: src/landing/pages/LandingScoresPage.tsx
// 성적 통계 list + detail 통합 페이지 (Phase #13, 2026-05-12).
//
// 본질: 학원 홍보 = 객관적 성적 통계의 정기 노출. 매치업 + 성적 = 학원 정체성 핵심.
// 학원장이 선생앱 성적탭 1버튼 publish → 본 페이지에 카드로 자동 노출.
//
// 외부 학부모 시점 — 비로그인 OK. 학생 이름 마스킹 (서버 SSOT).
// expired 시: 외부는 카드 메타 (count/avg/max)만, 학원장은 상세 영구 열람.
/* eslint-disable no-restricted-syntax */

import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { fetchLandingPublic } from "../api";
import {
  fetchShowcaseDetail,
  fetchShowcaseList,
  type PublicExamShowcase,
  type ShowcaseSummary,
} from "../api/publicCommunity";
import type { LandingConfig, LandingPublicResponse } from "../types";
import { LandingNavBar, type NavBarTokens } from "../templates/shared";
import LandingFooter, { FOOTER_TOKENS_DARK } from "../components/LandingFooter";
import LandingRoleFab from "../components/LandingRoleFab";
import { formatLandingYmdDate as formatDate } from "../utils/dateFormat";

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

const GOLD = "#D4A04C";
const BG = "#0A0E1A";
const BG_ALT = "#0F1525";
const BORDER = "rgba(255,255,255,0.08)";
const CARD_BG = "rgba(255,255,255,0.03)";
const TEXT_PRIMARY = "#F5F1E8";
const TEXT_SECONDARY = "#9CA3AF";
const TEXT_MUTED = "#6B7280";

const EMPTY_SHOWCASE_SUMMARY: ShowcaseSummary = {
  count: 0,
  avg: 0,
  max: 0,
  min: 0,
  max_score_full: 0,
  exam_title: "",
};

function BrandMark({ name }: { name: string }) {
  const initial = (name || "").trim().charAt(0) || "•";
  return (
    <div style={{ width: 36, height: 36, borderRadius: 9, background: "linear-gradient(135deg, #D4A04C 0%, #8B5E1F 100%)", display: "flex", alignItems: "center", justifyContent: "center", color: "#0A0E1A", fontSize: 18, fontWeight: 800 }}>{initial}</div>
  );
}

function Shell({ cfg, children }: { cfg: LandingConfig; children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", background: BG, color: TEXT_PRIMARY, fontFamily: "'Pretendard Variable', 'Pretendard', system-ui, sans-serif", letterSpacing: "-0.011em" }}>
      <LandingNavBar config={cfg} sections={cfg.sections || []} tokens={NAV_TOKENS} brandMark={<BrandMark name={cfg.brand_name} />} />
      {children}
      <LandingFooter config={cfg} sections={cfg.sections || []} tokens={FOOTER_TOKENS_DARK} />
      <LandingRoleFab />
    </div>
  );
}

function CenterSpin() {
  return (
    <div style={{ minHeight: "100vh", background: BG, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: 36, height: 36, border: "3px solid rgba(255,255,255,0.15)", borderTopColor: GOLD, borderRadius: "50%", animation: "spin 0.6s linear infinite" }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  );
}

// ─────────────────────────────────────────────
// List Page
// ─────────────────────────────────────────────

export function LandingScoresListPage() {
  const [landing, setLanding] = useState<LandingPublicResponse | null>(null);
  const [list, setList] = useState<PublicExamShowcase[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => { fetchLandingPublic().then(setLanding).catch(() => setLanding(null)); }, []);
  useEffect(() => {
    fetchShowcaseList()
      .then((r) => setList(r.results))
      .catch(() => { setError(true); setList([]); });
  }, []);

  if (!landing?.config) return <CenterSpin />;
  const cfg = landing.config;

  return (
    <Shell cfg={cfg}>
      {/* 헤더 */}
      <section style={{ padding: "56px 24px 28px", borderBottom: `1px solid ${BORDER}` }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: GOLD, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>
            Score Stats · 성적 통계
          </div>
          <h1 style={{ fontSize: "clamp(24px, 3vw, 34px)", fontWeight: 800, margin: 0, letterSpacing: "-0.025em", lineHeight: 1.25 }}>
            우리 학원 시험 결과 통계
          </h1>
          <p style={{ marginTop: 12, fontSize: 14, color: TEXT_SECONDARY, maxWidth: 640, lineHeight: 1.6 }}>
            학원에서 진행된 시험의 익명 석차·점수 통계입니다. 학생 개인정보는 마스킹되며,
            학원장이 직접 게시·검증한 자료입니다.
          </p>
        </div>
      </section>

      {/* 본문 */}
      <section style={{ padding: "32px 24px 64px", background: BG_ALT, minHeight: "60vh" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          {list === null && !error ? (
            <SkelGrid />
          ) : !list || list.length === 0 ? (
            <EmptyBox>아직 등록된 시험 통계가 없습니다.</EmptyBox>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
              {list.map((s) => (
                <ShowcaseCard key={s.id} showcase={s} />
              ))}
            </div>
          )}
        </div>
      </section>
    </Shell>
  );
}

function ShowcaseCard({ showcase }: { showcase: PublicExamShowcase }) {
  const s = showcase.summary ?? EMPTY_SHOWCASE_SUMMARY;
  const expiredBadge = showcase.expired;
  return (
    <Link to={`/landing/scores/${showcase.id}`} data-testid={`showcase-card-${showcase.id}`}
      style={{
        display: "flex", flexDirection: "column", gap: 12,
        padding: 20, borderRadius: 16, border: `1px solid ${BORDER}`,
        background: CARD_BG, color: TEXT_PRIMARY, textDecoration: "none",
        transition: "border-color 0.15s, transform 0.15s",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = `${GOLD}66`; e.currentTarget.style.transform = "translateY(-2px)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = BORDER; e.currentTarget.style.transform = "translateY(0)"; }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        {expiredBadge && (
          <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 999, background: "rgba(148,163,184,0.18)", color: TEXT_SECONDARY }}>
            기간 만료 (요약만)
          </span>
        )}
        <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 999, background: `${GOLD}1F`, color: GOLD }}>
          익명 통계
        </span>
      </div>
      <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, lineHeight: 1.4, letterSpacing: "-0.015em", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
        {showcase.title || "성적 통계"}
      </h3>
      {/* KPI mini */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
        <KpiMini label="응시" value={`${s.count ?? 0}명`} />
        <KpiMini label="평균" value={`${(s.avg ?? 0).toFixed(1)}`} />
        <KpiMini label="최고" value={`${(s.max ?? 0).toFixed(0)}`} />
      </div>
      <div style={{ fontSize: 12, color: TEXT_MUTED, marginTop: "auto" }}>
        {showcase.published_at ? formatDate(showcase.published_at) : "—"}
      </div>
    </Link>
  );
}

function KpiMini({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ padding: "10px 8px", borderRadius: 10, background: "rgba(255,255,255,0.02)", border: `1px solid ${BORDER}`, textAlign: "center" }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: TEXT_MUTED, letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 800, color: TEXT_PRIMARY, letterSpacing: "-0.02em" }}>{value}</div>
    </div>
  );
}

function EmptyBox({ children }: { children: React.ReactNode }) {
  return <div style={{ padding: "56px 24px", borderRadius: 14, background: CARD_BG, border: `1px solid ${BORDER}`, textAlign: "center", fontSize: 14, color: TEXT_SECONDARY }}>{children}</div>;
}

function SkelGrid() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} style={{ height: 180, background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 16 }} />
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────
// Detail Page
// ─────────────────────────────────────────────

export function LandingScoresDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [landing, setLanding] = useState<LandingPublicResponse | null>(null);
  const [showcase, setShowcase] = useState<PublicExamShowcase | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => { fetchLandingPublic().then(setLanding).catch(() => setLanding(null)); }, []);
  useEffect(() => {
    const n = Number(id);
    if (!Number.isFinite(n)) { setError(true); return; }
    fetchShowcaseDetail(n).then(setShowcase).catch(() => setError(true));
  }, [id]);

  if (!landing?.config) return <CenterSpin />;
  const cfg = landing.config;

  if (error) {
    return (
      <Shell cfg={cfg}>
        <div style={{ maxWidth: 600, margin: "0 auto", padding: "120px 24px", textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🔍</div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>통계를 찾을 수 없습니다</h1>
          <p style={{ marginTop: 12, fontSize: 14, color: TEXT_SECONDARY }}>삭제되었거나 비공개로 전환된 통계일 수 있습니다.</p>
          <Link to="/landing/scores" style={{ display: "inline-block", marginTop: 22, padding: "11px 22px", borderRadius: 999, background: GOLD, color: "#0A0E1A", textDecoration: "none", fontSize: 14, fontWeight: 700 }}>성적 통계 목록 →</Link>
        </div>
      </Shell>
    );
  }

  if (!showcase) return <Shell cfg={cfg}><CenterSpin /></Shell>;

  const s = showcase.summary ?? EMPTY_SHOWCASE_SUMMARY;
  const expired = showcase.expired;
  const showRows = (showcase.rows && showcase.rows.length > 0);

  return (
    <Shell cfg={cfg}>
      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "40px 24px 80px" }}>
        {/* nav */}
        <Link to="/landing/scores" data-testid="scores-detail-back"
          style={{ display: "inline-flex", alignItems: "center", gap: 6, color: TEXT_SECONDARY, textDecoration: "none", fontSize: 13, fontWeight: 600, marginBottom: 20 }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><polyline points="15,18 9,12 15,6" /></svg>
          성적 통계 목록
        </Link>

        {/* 헤더 + summary */}
        <article style={{ padding: 32, borderRadius: 16, background: CARD_BG, border: `1px solid ${BORDER}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
            {expired && <Chip color={TEXT_SECONDARY} bg="rgba(148,163,184,0.18)">기간 만료</Chip>}
            <Chip color={GOLD} bg={`${GOLD}1F`}>익명 통계</Chip>
            <span style={{ fontSize: 12, color: TEXT_MUTED, marginLeft: "auto" }}>
              조회 {showcase.view_count} · 게시 {formatDate(showcase.published_at)}
            </span>
          </div>
          <h1 style={{ margin: 0, fontSize: "clamp(22px, 3vw, 28px)", fontWeight: 800, letterSpacing: "-0.025em" }}>{showcase.title}</h1>
          {showcase.description && (
            <p style={{ marginTop: 12, fontSize: 14, color: TEXT_SECONDARY, lineHeight: 1.6 }}>{showcase.description}</p>
          )}

          {/* KPI band */}
          <div style={{ marginTop: 28, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12 }}>
            <KpiCard label="응시 인원" value={`${s.count ?? 0}명`} />
            <KpiCard label="평균 점수" value={`${(s.avg ?? 0).toFixed(1)}`} sub={s.max_score_full ? ` / ${s.max_score_full}` : ""} />
            <KpiCard label="최고" value={`${(s.max ?? 0).toFixed(0)}`} />
            <KpiCard label="최저" value={`${(s.min ?? 0).toFixed(0)}`} />
          </div>
        </article>

        {/* 익명 석차 table */}
        <section style={{ marginTop: 32 }}>
          <h2 style={{ margin: "0 0 16px", fontSize: 18, fontWeight: 800, color: TEXT_PRIMARY, letterSpacing: "-0.02em" }}>
            익명 석차 {showRows ? `(${showcase.rows!.length}명)` : ""}
          </h2>
          {!showRows ? (
            <div style={{ padding: "48px 24px", borderRadius: 14, background: CARD_BG, border: `1px dashed ${BORDER}`, textAlign: "center", color: TEXT_SECONDARY, fontSize: 13.5 }}>
              {expired
                ? "외부 상세 노출 기간이 종료되었습니다. 통계 요약만 확인 가능합니다."
                : "표시할 석차 데이터가 없습니다."}
            </div>
          ) : (
            <div style={{ borderRadius: 14, border: `1px solid ${BORDER}`, overflow: "hidden", background: CARD_BG }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                <thead>
                  <tr style={{ background: "rgba(255,255,255,0.03)" }}>
                    <th style={thStyle("60px", "center")}>등수</th>
                    <th style={thStyle("auto", "left")}>학생</th>
                    <th style={thStyle("100px", "right")}>점수</th>
                    <th style={thStyle("100px", "right")}>비율</th>
                  </tr>
                </thead>
                <tbody>
                  {showcase.rows!.map((r, i) => (
                    <tr key={i} style={{ borderTop: `1px solid ${BORDER}`, transition: "background 0.12s" }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.02)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                    >
                      <td style={tdStyle("center")}>
                        <span style={{ fontSize: 14, fontWeight: 800, color: r.rank <= 3 ? GOLD : TEXT_PRIMARY }}>
                          {r.rank}
                        </span>
                        <span style={{ fontSize: 10, color: TEXT_MUTED, marginLeft: 4 }}>/ {r.total}</span>
                      </td>
                      <td style={tdStyle("left")}>
                        <span style={{ fontSize: 14, color: TEXT_PRIMARY, fontWeight: 600 }}>{r.display_name}</span>
                      </td>
                      <td style={{ ...tdStyle("right"), fontVariantNumeric: "tabular-nums" }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: TEXT_PRIMARY }}>{r.score}</span>
                        <span style={{ fontSize: 11, color: TEXT_MUTED, marginLeft: 4 }}>/ {r.max_score}</span>
                      </td>
                      <td style={{ ...tdStyle("right"), fontVariantNumeric: "tabular-nums" }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: r.percent >= 80 ? GOLD : r.percent >= 60 ? TEXT_PRIMARY : TEXT_SECONDARY }}>
                          {r.percent}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <div style={{ marginTop: 32, padding: 16, borderRadius: 12, background: "rgba(212,160,76,0.06)", border: `1px solid ${GOLD}33`, fontSize: 12, color: TEXT_SECONDARY, lineHeight: 1.6 }}>
          ℹ 본 통계는 학원장이 게시한 시점의 시험 결과 snapshot 입니다. 학생 개인정보는 마스킹되며, 실제 점수 데이터는 학원 내부 시스템에 보호되어 보관됩니다.
        </div>
      </div>
    </Shell>
  );
}

function KpiCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div style={{ padding: "16px 18px", borderRadius: 12, background: "rgba(255,255,255,0.02)", border: `1px solid ${BORDER}` }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: GOLD, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color: TEXT_PRIMARY, letterSpacing: "-0.02em" }}>
        {value}
        {sub && <span style={{ fontSize: 14, color: TEXT_MUTED, fontWeight: 600, marginLeft: 4 }}>{sub}</span>}
      </div>
    </div>
  );
}

function Chip({ color, bg, children }: { color: string; bg: string; children: React.ReactNode }) {
  return <span style={{ fontSize: 10, fontWeight: 700, color, letterSpacing: "0.05em", padding: "3px 8px", borderRadius: 999, background: bg }}>{children}</span>;
}

function thStyle(width: string, align: "left" | "right" | "center"): React.CSSProperties {
  return { width, padding: "12px 14px", fontSize: 11, fontWeight: 700, color: TEXT_MUTED, textAlign: align, letterSpacing: "0.05em", textTransform: "uppercase" };
}

function tdStyle(align: "left" | "right" | "center"): React.CSSProperties {
  return { padding: "12px 14px", textAlign: align };
}
