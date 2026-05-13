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
import { resolveTenantCode } from "@/shared/tenant";
import useAuth from "@/auth/hooks/useAuth";

function formatDate(iso: string | null): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
  } catch {
    return iso;
  }
}

function StatusBadge({ card, accent }: { card: MatchupShowcaseCard; accent: string }) {
  if (card.expired) {
    return (
      <span style={{ display: "inline-flex", alignItems: "center", padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", background: "rgba(245,158,11,0.15)", color: "#92400e" }}>
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

  const accent = config?.config?.primary_color || "#1E3A5F";
  const brandName = config?.config?.brand_name || "학원";

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", color: "#0f172a" }}>
      {/* 상단 brand bar */}
      <div style={{ background: "#fff", borderBottom: "1px solid #e2e8f0", padding: "16px 24px" }}>
        <div style={{ maxWidth: 1080, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <Link to="/landing" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none", color: "#0f172a" }}>
            {config?.config?.logo_url && (
              <img src={config.config.logo_url} alt="" style={{ height: 28, width: "auto", objectFit: "contain" }} />
            )}
            <span style={{ fontSize: 16, fontWeight: 700, letterSpacing: "-0.02em" }}>{brandName}</span>
          </Link>
          {isOwner && (
            <Link to="/landing/admin/matchup-board" style={{ padding: "8px 14px", borderRadius: 999, background: "rgba(212,160,76,0.12)", color: "#B8862F", fontSize: 12.5, fontWeight: 700, textDecoration: "none", border: "1px solid rgba(212,160,76,0.35)" }}>
              ⚙️ 게시판 관리
            </Link>
          )}
        </div>
      </div>

      {/* 헤더 */}
      <div style={{ maxWidth: 1080, margin: "0 auto", padding: "32px 24px 16px" }}>
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: accent, marginBottom: 8 }}>Matchup</div>
        <h1 style={{ fontSize: 28, fontWeight: 800, margin: "0 0 8px", letterSpacing: "-0.02em" }}>적중 보고서</h1>
        <p style={{ fontSize: 14, color: "#64748b", margin: 0, lineHeight: 1.6 }}>
          {brandName}이(가) 학교 시험에서 적중시킨 문항을 강사 자필 코멘트와 함께 공유합니다.
        </p>
      </div>

      <div style={{ maxWidth: 1080, margin: "0 auto", padding: "0 24px 64px" }}>
        {loading ? (
          <div style={{ padding: 80, textAlign: "center", color: "#64748b" }}>불러오는 중…</div>
        ) : error ? (
          <div style={{ padding: 24, borderRadius: 12, background: "#fef2f2", border: "1px solid #fecaca", color: "#991b1b" }}>
            {error}
          </div>
        ) : items.length === 0 ? (
          <div style={{ padding: 64, textAlign: "center", background: "#fff", borderRadius: 16, border: "1px dashed #cbd5e1" }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>📚</div>
            <p style={{ fontSize: 15, fontWeight: 700, margin: "0 0 8px" }}>아직 공개된 적중 보고서가 없습니다</p>
            <p style={{ fontSize: 13, color: "#64748b", margin: 0, lineHeight: 1.5 }}>
              학원에서 게시 준비 중입니다. 잠시 후 다시 확인해주세요.
            </p>
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
                    background: "#fff",
                    borderRadius: 14,
                    border: "1px solid #e2e8f0",
                    padding: 18,
                    cursor: clickable ? "pointer" : "default",
                    opacity: clickable ? 1 : 0.7,
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                    transition: "transform 0.15s, box-shadow 0.15s",
                  }}
                  onMouseEnter={(e) => { if (clickable) { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 12px 24px rgba(0,0,0,0.06)"; } }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none"; }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <StatusBadge card={card} accent={accent} />
                    {hitRate !== undefined && (
                      <span style={{ fontSize: 11, fontWeight: 700, color: accent }}>
                        적중률 {Math.round((hitRate || 0) * 100)}%
                      </span>
                    )}
                    {hitCount !== undefined && countedEntries !== undefined && (
                      <span style={{ fontSize: 11, color: "#64748b" }}>
                        {hitCount}/{countedEntries}
                      </span>
                    )}
                  </div>
                  <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0, lineHeight: 1.4, letterSpacing: "-0.01em", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{card.title}</h3>
                  {card.description && (
                    <p style={{ fontSize: 12.5, color: "#475569", margin: 0, lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{card.description}</p>
                  )}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11, color: "#94a3b8", marginTop: "auto", paddingTop: 8, borderTop: "1px solid #f1f5f9" }}>
                    <span>
                      {card.snapshot_meta?.author_name || ""} · {formatDate(card.published_at)}
                    </span>
                    <span>👁 {card.view_count}</span>
                  </div>
                  {!clickable && card.expired && (
                    <div style={{ marginTop: 4, fontSize: 11, color: "#92400e", padding: "6px 10px", borderRadius: 6, background: "rgba(245,158,11,0.1)" }}>
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
              const apiBase = (import.meta.env.VITE_API_BASE_URL as string) || "";
              const raw = viewing.pdf_url || "";
              const abs = raw.startsWith("http") ? raw : `${apiBase}${raw}`;
              const tc = typeof tenantCode === "string" ? tenantCode : "";
              const src = (tc && !abs.includes("tenant=")) ? `${abs}${abs.includes("?") ? "&" : "?"}tenant=${tc}` : abs;
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
    </div>
  );
}
