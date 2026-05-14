// PATH: src/landing/pages/LandingMatchupBoardDetailPage.tsx
// 매치업 적중보고서 게시물 단일 detail page — 박철T 학원장 spec (Phase #74, 2026-05-13).
//
// 호소: "홈페이지 매치업만 볼 수 있는 링크에 제가 위에 올린 파일만 업로드.
// 내일 수업 자랑하고 싶음." → 학원 전체 list URL 이 아닌 PDF 1개만 보이는 dedicated URL.
//
// 이 페이지: 학원 brand 헤더 + 카드 메타 + PDF iframe full + footer. 비로그인 OK
// (backend `is_publicly_visible()` 통과 시점만). 학원장은 항상 preview 가능.
/* eslint-disable no-restricted-syntax */

import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { fetchLandingPublic } from "../api";
import { fetchMatchupShowcaseDetail, type MatchupShowcaseCard } from "../api/matchupShowcase";
import type { LandingPublicResponse } from "../types";
import { resolveTenantCode } from "@/shared/tenant";
import { setLandingMeta as setMeta } from "../utils/seoMeta";
import useAuth from "@/auth/hooks/useAuth";

function formatDate(iso: string | null): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
  } catch { return iso; }
}

export default function LandingMatchupBoardDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [config, setConfig] = useState<LandingPublicResponse | null>(null);
  const [card, setCard] = useState<MatchupShowcaseCard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  const isOwner = !!(user?.is_superuser || user?.tenantRole === "owner" || user?.tenantRole === "admin");
  const tenantCode = resolveTenantCode();

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const nid = Number(id);
      if (!Number.isFinite(nid) || nid <= 0) {
        setError("잘못된 게시물 번호입니다.");
        return;
      }
      const [landingResp, cardResp] = await Promise.all([
        fetchLandingPublic(),
        fetchMatchupShowcaseDetail(nid, { skipAuth: !user }),
      ]);
      setConfig(landingResp);
      setCard(cardResp);
    } catch (e) {
      const err = e as { response?: { status?: number; data?: { detail?: string } } };
      const s = err.response?.status;
      if (s === 404) setError("게시물을 찾을 수 없습니다.");
      else if (s === 403) setError("비공개 상태입니다.");
      else {
        const d = err.response?.data?.detail;
        setError(typeof d === "string" ? d : "조회 실패");
      }
    } finally {
      setLoading(false);
    }
  }, [id, user]);

  useEffect(() => { void reload(); }, [reload]);

  useEffect(() => {
    if (card && config?.config) {
      const brand = config.config.brand_name;
      document.title = `${card.title} — ${brand}`;
      setMeta("og:title", card.title);
      setMeta("og:description", card.description || `${brand} 적중 보고서`);
      setMeta("description", card.description || `${brand} 적중 보고서`);
    }
  }, [card, config]);

  const accent = config?.config?.primary_color || "#1E3A5F";
  const brandName = config?.config?.brand_name || "학원";

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: "#64748b", fontSize: 13 }}>불러오는 중…</div>
      </div>
    );
  }

  if (error || !card) {
    return (
      <div style={{ minHeight: "100vh", background: "#f8fafc", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, padding: 24, textAlign: "center" }}>
        <div style={{ fontSize: 36, marginBottom: 4 }}>🔒</div>
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>{error || "게시물 없음"}</h1>
        <p style={{ fontSize: 13, color: "#64748b", margin: 0, lineHeight: 1.6 }}>
          공개 기간이 끝났거나 학원에서 비공개로 전환했을 수 있어요.
        </p>
        <Link to="/landing/matchup-board" style={{ marginTop: 12, color: "#2563eb", textDecoration: "none", fontSize: 13, fontWeight: 700 }}>
          ← 적중 보고서 목록
        </Link>
      </div>
    );
  }

  const hitRate = card.snapshot_meta?.hit_rate;
  const hitCount = card.snapshot_meta?.hit_count;
  const countedEntries = card.snapshot_meta?.counted_entries;
  const visibleNow = card.visible;
  // 본 결함 fix (Phase #74-2, 2026-05-13 시각 검수 발견):
  // backend pdf_url 가 `/api/v1/...` 상대 path → iframe src에 그대로 박으면
  // frontend Cloudflare Pages 도메인으로 가서 SPA fallback이 메인 랜딩을 로드 →
  // 학생이 PDF가 아니라 학원 메인 페이지 봄. apiBase 프리픽스로 backend 절대 URL.
  const apiBase = (import.meta.env.VITE_API_BASE_URL as string) || "";
  const pdfUrl = (() => {
    const raw = card.pdf_url;
    if (!raw) return null;
    const abs = raw.startsWith("http") ? raw : `${apiBase}${raw}`;
    if (tenantCode.ok && !abs.includes("tenant=")) {
      return `${abs}${abs.includes("?") ? "&" : "?"}tenant=${tenantCode.code}`;
    }
    return abs;
  })();

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", color: "#0f172a", display: "flex", flexDirection: "column" }}>
      {/* 상단 brand bar */}
      <div style={{ background: "#fff", borderBottom: "1px solid #e2e8f0", padding: "14px 24px", flexShrink: 0 }}>
        <div style={{ maxWidth: 1080, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <Link to="/landing" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none", color: "#0f172a" }}>
            {config?.config?.logo_url && (
              <img src={config.config.logo_url} alt="" style={{ height: 28, width: "auto", objectFit: "contain" }} />
            )}
            <span style={{ fontSize: 16, fontWeight: 700, letterSpacing: "-0.02em" }}>{brandName}</span>
          </Link>
          <div style={{ display: "flex", gap: 8 }}>
            <Link to="/landing/matchup-board" style={{ padding: "7px 14px", borderRadius: 999, background: "rgba(15,23,42,0.05)", color: "#475569", fontSize: 12.5, fontWeight: 700, textDecoration: "none", border: "1px solid rgba(15,23,42,0.08)" }}>
              ← 적중 보고서 목록
            </Link>
            {isOwner && (
              <Link to="/landing/admin/matchup-board" style={{ padding: "7px 14px", borderRadius: 999, background: "rgba(212,160,76,0.12)", color: "#B8862F", fontSize: 12.5, fontWeight: 700, textDecoration: "none", border: "1px solid rgba(212,160,76,0.35)" }}>
                ⚙️ 게시판 관리
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* 헤더 (카드 메타) */}
      <div style={{ background: "#fff", borderBottom: "1px solid #e2e8f0", flexShrink: 0 }}>
        <div style={{ maxWidth: 1080, margin: "0 auto", padding: "20px 24px 18px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
            <span style={{ display: "inline-flex", alignItems: "center", padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", background: accent, color: "#fff" }}>적중 보고서</span>
            {hitRate !== undefined && (
              <span style={{ fontSize: 12, fontWeight: 700, color: accent }}>
                적중률 {Math.round((hitRate || 0) * 100)}%
                {hitCount !== undefined && countedEntries !== undefined && (
                  <span style={{ color: "#94a3b8", fontWeight: 500, marginLeft: 4 }}>({hitCount}/{countedEntries})</span>
                )}
              </span>
            )}
            {!visibleNow && (
              <span style={{ display: "inline-flex", alignItems: "center", padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700, background: "rgba(245,158,11,0.12)", color: "#92400e" }}>
                {card.expired ? "공개 기간 종료" : "비공개"}
              </span>
            )}
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, letterSpacing: "-0.02em", lineHeight: 1.35 }}>{card.title}</h1>
          {card.description && (
            <p style={{ fontSize: 13.5, color: "#475569", margin: "8px 0 0", lineHeight: 1.65 }}>{card.description}</p>
          )}
          <div style={{ marginTop: 10, display: "flex", gap: 14, fontSize: 11.5, color: "#64748b", flexWrap: "wrap" }}>
            <span>{card.snapshot_meta?.author_name || brandName}</span>
            <span>· {formatDate(card.published_at)}</span>
            <span>· 조회 {card.view_count}</span>
          </div>
        </div>
      </div>

      {/* PDF action bar — 학생 카톡 in-app browser fallback (iframe PDF 못 렌더하는 환경 대응) */}
      {pdfUrl && (
        <div style={{ background: "#fff", borderBottom: "1px solid #e2e8f0", padding: "10px 24px", flexShrink: 0 }}>
          <div style={{ maxWidth: 1080, margin: "0 auto", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ fontSize: 12, color: "#64748b" }}>PDF가 안 보이면 ↓</span>
            <a
              href={pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{ padding: "7px 14px", borderRadius: 999, background: accent, color: "#fff", fontSize: 12.5, fontWeight: 700, textDecoration: "none" }}
            >📄 새 탭에서 열기</a>
            <a
              href={pdfUrl}
              download
              style={{ padding: "7px 14px", borderRadius: 999, background: "rgba(15,23,42,0.05)", color: "#475569", fontSize: 12.5, fontWeight: 700, textDecoration: "none", border: "1px solid rgba(15,23,42,0.08)" }}
            >⬇️ 다운로드</a>
          </div>
        </div>
      )}

      {/* PDF iframe area */}
      <div style={{ flex: 1, position: "relative", background: "#f1f5f9", minHeight: 600 }}>
        {pdfUrl ? (
          <iframe
            src={pdfUrl}
            title={card.title}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: "none", background: "#fff" }}
          />
        ) : (
          <div style={{ padding: 48, textAlign: "center", color: "#64748b", lineHeight: 1.6 }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>📄</div>
            <p style={{ fontSize: 14, fontWeight: 700, margin: "0 0 6px", color: "#0f172a" }}>본문 PDF를 볼 수 없습니다</p>
            <p style={{ fontSize: 12.5, margin: 0 }}>공개 기간이 지났거나 학원에서 비공개 상태로 두었어요.</p>
          </div>
        )}
      </div>
    </div>
  );
}
