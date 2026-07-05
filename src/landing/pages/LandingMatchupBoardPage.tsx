// PATH: src/landing/pages/LandingMatchupBoardPage.tsx
// 공개 매치업 적중보고서 게시판 — 학생/학부모/외부인 read (Phase #69, 2026-05-13).
//
// 본질: 학원장이 게시한 PublicMatchupShowcase 게시물 리스트 노출 + PDF iframe 상세.
//   - PUBLISHED + window 안 게시물만 backend가 반환 (window 밖은 EXPIRED 카드만)
//   - 카드 클릭 → modal로 PDF iframe (X-Frame-Options exempt)
//   - 비로그인 OK (학원 family 가입 안 한 외부 학부모도 접근)
/* eslint-disable no-restricted-syntax */

import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchLandingPublic } from "../api";
import {
  fetchMatchupShowcaseList,
  type MatchupShowcaseCard,
} from "../api/matchupShowcase";
import type { LandingPublicResponse } from "../types";
import {
  MatchupCenterSpin,
  MatchupCenterState,
  MatchupLandingShell,
} from "./LandingMatchupBoardShell";
import { MATCHUP_COLORS } from "./LandingMatchupBoardTokens";
import { formatLandingYmdDateOrRaw as formatDate } from "../utils/dateFormat";
import { resolveTenantCode } from "@/shared/tenant";
import useAuth from "@/auth/hooks/useAuth";

function StatusBadge({ card, accent }: { card: MatchupShowcaseCard; accent: string }) {
  if (card.expired) {
    return (
      <span style={{ display: "inline-flex", alignItems: "center", padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", background: "rgba(245,158,11,0.15)", color: "#FBBF24" }}>
        기간 만료
      </span>
    );
  }
  return (
    <span style={{ display: "inline-flex", alignItems: "center", padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", background: accent, color: "#fff" }}>
      공개
    </span>
  );
}

export default function LandingMatchupBoardPage() {
  const [config, setConfig] = useState<LandingPublicResponse | null>(null);
  const [items, setItems] = useState<MatchupShowcaseCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewing, setViewing] = useState<MatchupShowcaseCard | null>(null);
  const { user } = useAuth();
  const isOwner = !!(user?.is_superuser || user?.tenantRole === "owner" || user?.tenantRole === "admin");
  const tenantCode = resolveTenantCode();
  const hasHitReports = (config?.config?.sections || []).some((section) => (
    section.enabled && section.type === "hit_reports" && Array.isArray(section.items) && section.items.length > 0
  ));

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [landingResp, listResp] = await Promise.all([
        fetchLandingPublic(),
        fetchMatchupShowcaseList({ skipAuth: !user }),
      ]);
      setConfig(landingResp);
      setItems(listResp.results);
    } catch (e) {
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(typeof detail === "string" ? detail : "게시판 조회 실패");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { void reload(); }, [reload]);

  useEffect(() => {
    if (!viewing) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setViewing(null); };
    document.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = prev; document.removeEventListener("keydown", onKey); };
  }, [viewing]);

  const cfg = config?.config;
  const accent = cfg?.primary_color || MATCHUP_COLORS.gold;
  const brandName = cfg?.brand_name || "학원";

  if (!cfg && loading) {
    return <MatchupCenterSpin />;
  }

  if (!cfg) {
    return (
      <MatchupCenterState>
        <div style={{ fontSize: 34, marginBottom: 12 }}>!</div>
        <h1 style={{ fontSize: 20, fontWeight: 800, margin: "0 0 8px" }}>적중 보고서를 불러오지 못했습니다</h1>
        <p style={{ fontSize: 13, color: MATCHUP_COLORS.textSecondary, margin: 0, lineHeight: 1.65 }}>
          {error || "랜딩 설정을 다시 확인해주세요."}
        </p>
        <Link
          to="/landing"
          style={{
            display: "inline-flex",
            marginTop: 18,
            padding: "10px 16px",
            borderRadius: 8,
            background: MATCHUP_COLORS.gold,
            color: MATCHUP_COLORS.bg,
            fontSize: 13,
            fontWeight: 800,
            textDecoration: "none",
          }}
        >
          홈으로 이동
        </Link>
      </MatchupCenterState>
    );
  }

  return (
    <MatchupLandingShell cfg={cfg}>
      <section
        style={{
          position: "relative",
          overflow: "hidden",
          borderBottom: `1px solid ${MATCHUP_COLORS.border}`,
          background: `radial-gradient(circle at 20% 0%, rgba(212,160,76,0.18), transparent 32%), linear-gradient(180deg, ${MATCHUP_COLORS.bgAlt} 0%, ${MATCHUP_COLORS.bg} 100%)`,
        }}
      >
        <div style={{ maxWidth: 1080, margin: "0 auto", padding: "42px 24px 28px", display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 20, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: accent, marginBottom: 9 }}>Matchup</div>
            <h1 style={{ fontSize: "clamp(28px, 4vw, 42px)", fontWeight: 900, margin: "0 0 10px", lineHeight: 1.16 }}>적중 보고서</h1>
            <p style={{ fontSize: 14.5, color: MATCHUP_COLORS.textSecondary, margin: 0, lineHeight: 1.7, maxWidth: 620 }}>
              {brandName}이(가) 학교 시험에서 적중시킨 문항을 강사 자필 코멘트와 함께 공유합니다.
            </p>
          </div>
          {isOwner && (
            <Link
              to="/landing/admin/matchup-board"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                minHeight: 38,
                padding: "9px 14px",
                borderRadius: 8,
                background: "rgba(212,160,76,0.14)",
                color: "#F5D08C",
                fontSize: 12.5,
                fontWeight: 800,
                textDecoration: "none",
                border: "1px solid rgba(212,160,76,0.36)",
              }}
            >
              게시판 관리
            </Link>
          )}
        </div>
      </section>

      <div style={{ maxWidth: 1080, margin: "0 auto", padding: "28px 24px 72px" }}>
        {loading ? (
          <div style={{ padding: 80, textAlign: "center", color: MATCHUP_COLORS.textSecondary }}>불러오는 중...</div>
        ) : error ? (
          <div style={{ padding: 24, borderRadius: 8, background: "rgba(153,27,27,0.16)", border: "1px solid rgba(248,113,113,0.28)", color: "#FCA5A5" }}>
            {error}
          </div>
        ) : items.length === 0 ? (
          <div style={{ padding: 64, textAlign: "center", background: MATCHUP_COLORS.bgSoft, borderRadius: 8, border: `1px dashed ${MATCHUP_COLORS.borderStrong}` }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>+</div>
            <p style={{ fontSize: 15, fontWeight: 800, margin: "0 0 8px" }}>아직 공개된 적중 보고서가 없습니다</p>
            <p style={{ fontSize: 13, color: MATCHUP_COLORS.textSecondary, margin: 0, lineHeight: 1.5 }}>
              학원에서 게시 준비 중입니다. 잠시 후 다시 확인해주세요.
            </p>
            {hasHitReports && (
              <Link
                to="/landing/reports"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginTop: 18,
                  padding: "10px 18px",
                  borderRadius: 8,
                  background: accent,
                  color: MATCHUP_COLORS.bg,
                  fontSize: 13,
                  fontWeight: 800,
                  textDecoration: "none",
                }}
              >
                기존 적중 보고서 보기
              </Link>
            )}
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
            {items.map((card) => {
              const clickable = card.visible && card.pdf_url;
              const hitRate = card.snapshot_meta?.hit_rate;
              const hitCount = card.snapshot_meta?.hit_count;
              const countedEntries = card.snapshot_meta?.counted_entries;
              return (
                <button
                  key={card.id}
                  type="button"
                  data-testid={`landing-matchup-card-${card.id}`}
                  onClick={() => clickable && setViewing(card)}
                  disabled={!clickable}
                  style={{
                    textAlign: "left",
                    background: MATCHUP_COLORS.bgSoft,
                    borderRadius: 8,
                    border: `1px solid ${MATCHUP_COLORS.border}`,
                    padding: 18,
                    cursor: clickable ? "pointer" : "default",
                    opacity: clickable ? 1 : 0.7,
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                    transition: "transform 0.15s, box-shadow 0.15s",
                  }}
                  onMouseEnter={(e) => { if (clickable) { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 16px 32px rgba(0,0,0,0.22)"; e.currentTarget.style.borderColor = "rgba(212,160,76,0.32)"; } }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.borderColor = MATCHUP_COLORS.border; }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <StatusBadge card={card} accent={accent} />
                    {hitRate !== undefined && (
                      <span style={{ fontSize: 11, fontWeight: 700, color: accent }}>
                        적중률 {Math.round((hitRate || 0) * 100)}%
                      </span>
                    )}
                    {hitCount !== undefined && countedEntries !== undefined && (
                      <span style={{ fontSize: 11, color: MATCHUP_COLORS.textMuted }}>
                        {hitCount}/{countedEntries}
                      </span>
                    )}
                  </div>
                  <h3 style={{ fontSize: 15, fontWeight: 800, margin: 0, lineHeight: 1.4, color: MATCHUP_COLORS.textPrimary, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{card.title}</h3>
                  {card.description && (
                    <p style={{ fontSize: 12.5, color: MATCHUP_COLORS.textSecondary, margin: 0, lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{card.description}</p>
                  )}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11, color: MATCHUP_COLORS.textMuted, marginTop: "auto", paddingTop: 8, borderTop: `1px solid ${MATCHUP_COLORS.border}` }}>
                    <span>
                      {card.snapshot_meta?.author_name || ""} · {formatDate(card.published_at)}
                    </span>
                    <span>조회 {card.view_count}</span>
                  </div>
                  {!clickable && card.expired && (
                    <div style={{ marginTop: 4, fontSize: 11, color: "#FBBF24", padding: "6px 10px", borderRadius: 6, background: "rgba(245,158,11,0.1)" }}>
                      공개 기간이 종료되었습니다.
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* PDF viewer modal */}
      {viewing && viewing.pdf_url && (
        <div
          onClick={() => setViewing(null)}
          style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(8,12,22,0.7)", backdropFilter: "blur(6px)", display: "flex", flexDirection: "column", padding: 0 }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ width: "min(960px, 100%)", height: "100%", margin: "0 auto", background: "#fff", display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "12px 16px", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexShrink: 0 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 2 }}>적중 보고서</div>
                <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{viewing.title}</h3>
              </div>
              <button type="button" onClick={() => setViewing(null)} aria-label="닫기"
                style={{ width: 36, height: 36, borderRadius: 8, border: "1px solid #cbd5e1", background: "#fff", color: "#475569", cursor: "pointer", fontSize: 18, lineHeight: 1, flexShrink: 0 }}
              >×</button>
            </div>
            {(() => {
              // detail page와 동일 fix — backend pdf_url 상대 path에 apiBase 프리픽스 부착.
              // 안 그러면 frontend SPA fallback이 메인 랜딩 페이지 로드 (#74-2).
              // P0 audit (2026-05-13): tenantCode는 { ok, code } 객체. 이전 typeof === "string"
              // 검사로 항상 false → tenant query 영구 미부착. detail page와 동일 ok/code 패턴.
              const apiBase = (import.meta.env.VITE_API_BASE_URL as string) || "";
              const raw = viewing.pdf_url || "";
              const abs = raw.startsWith("http") ? raw : `${apiBase}${raw}`;
              const src = (tenantCode.ok && !abs.includes("tenant="))
                ? `${abs}${abs.includes("?") ? "&" : "?"}tenant=${tenantCode.code}`
                : abs;
              return (
                <iframe
                  src={src}
                  title={viewing.title}
                  style={{ flex: 1, border: "none", width: "100%", background: "#f8fafc" }}
                />
              );
            })()}
          </div>
        </div>
      )}
    </MatchupLandingShell>
  );
}
