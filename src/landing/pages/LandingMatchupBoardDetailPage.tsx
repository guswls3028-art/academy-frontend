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
import {
  MatchupCenterSpin,
  MatchupCenterState,
  MatchupLandingShell,
} from "./LandingMatchupBoardShell";
import { MATCHUP_COLORS } from "./LandingMatchupBoardTokens";
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

  const cfg = config?.config;
  const accent = cfg?.primary_color || MATCHUP_COLORS.gold;
  const brandName = cfg?.brand_name || "학원";

  if (loading) {
    return <MatchupCenterSpin />;
  }

  if (error || !card) {
    return (
      <MatchupCenterState>
        <div style={{ fontSize: 34, marginBottom: 10 }}>!</div>
        <h1 style={{ fontSize: 20, fontWeight: 800, margin: "0 0 8px" }}>{error || "게시물 없음"}</h1>
        <p style={{ fontSize: 13, color: MATCHUP_COLORS.textSecondary, margin: 0, lineHeight: 1.65 }}>
          공개 기간이 끝났거나 학원에서 비공개로 전환했을 수 있어요.
        </p>
        <Link
          to="/landing/matchup-board"
          style={{
            display: "inline-flex",
            marginTop: 18,
            padding: "10px 16px",
            borderRadius: 8,
            background: MATCHUP_COLORS.gold,
            color: MATCHUP_COLORS.bg,
            textDecoration: "none",
            fontSize: 13,
            fontWeight: 800,
          }}
        >
          적중 보고서 목록
        </Link>
      </MatchupCenterState>
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

  if (!cfg) {
    return (
      <MatchupCenterState>
        <h1 style={{ fontSize: 20, fontWeight: 800, margin: "0 0 8px" }}>랜딩 설정을 불러오지 못했습니다</h1>
        <p style={{ fontSize: 13, color: MATCHUP_COLORS.textSecondary, margin: 0, lineHeight: 1.65 }}>
          잠시 후 다시 시도해주세요.
        </p>
      </MatchupCenterState>
    );
  }

  return (
    <MatchupLandingShell cfg={cfg} fill>
      {/* 헤더 (카드 메타) */}
      <div
        style={{
          background: `radial-gradient(circle at 20% 0%, rgba(212,160,76,0.16), transparent 30%), linear-gradient(180deg, ${MATCHUP_COLORS.bgAlt} 0%, ${MATCHUP_COLORS.bg} 100%)`,
          borderBottom: `1px solid ${MATCHUP_COLORS.border}`,
          flexShrink: 0,
        }}
      >
        <div style={{ maxWidth: 1080, margin: "0 auto", padding: "22px 24px 18px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap", marginBottom: 12 }}>
            <Link
              to="/landing/matchup-board"
              style={{
                padding: "8px 13px",
                borderRadius: 8,
                background: "rgba(255,255,255,0.06)",
                color: MATCHUP_COLORS.textSecondary,
                fontSize: 12.5,
                fontWeight: 800,
                textDecoration: "none",
                border: `1px solid ${MATCHUP_COLORS.border}`,
              }}
            >
              적중 보고서 목록
            </Link>
            {isOwner && (
              <Link
                to="/landing/admin/matchup-board"
                style={{
                  padding: "8px 13px",
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
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
            <span style={{ display: "inline-flex", alignItems: "center", padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 800, letterSpacing: "0.04em", background: accent, color: MATCHUP_COLORS.bg }}>적중 보고서</span>
            {hitRate !== undefined && (
              <span style={{ fontSize: 12, fontWeight: 800, color: accent }}>
                적중률 {Math.round((hitRate || 0) * 100)}%
                {hitCount !== undefined && countedEntries !== undefined && (
                  <span style={{ color: MATCHUP_COLORS.textMuted, fontWeight: 600, marginLeft: 4 }}>({hitCount}/{countedEntries})</span>
                )}
              </span>
            )}
            {!visibleNow && (
              <span style={{ display: "inline-flex", alignItems: "center", padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 800, background: "rgba(245,158,11,0.12)", color: "#FBBF24" }}>
                {card.expired ? "공개 기간 종료" : "비공개"}
              </span>
            )}
          </div>
          <h1 style={{ fontSize: "clamp(22px, 3vw, 32px)", fontWeight: 900, margin: 0, lineHeight: 1.35 }}>{card.title}</h1>
          {card.description && (
            <p style={{ fontSize: 13.5, color: MATCHUP_COLORS.textSecondary, margin: "8px 0 0", lineHeight: 1.65 }}>{card.description}</p>
          )}
          <div style={{ marginTop: 10, display: "flex", gap: 14, fontSize: 11.5, color: MATCHUP_COLORS.textMuted, flexWrap: "wrap" }}>
            <span>{card.snapshot_meta?.author_name || brandName}</span>
            <span>· {formatDate(card.published_at)}</span>
            <span>· 조회 {card.view_count}</span>
          </div>
        </div>
      </div>

      {/* PDF action bar — 학생 카톡 in-app browser fallback (iframe PDF 못 렌더하는 환경 대응) */}
      {pdfUrl && (
        <div style={{ background: MATCHUP_COLORS.bgAlt, borderBottom: `1px solid ${MATCHUP_COLORS.border}`, padding: "10px 24px", flexShrink: 0 }}>
          <div style={{ maxWidth: 1080, margin: "0 auto", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ fontSize: 12, color: MATCHUP_COLORS.textSecondary }}>PDF가 안 보이면</span>
            <a
              href={pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{ padding: "7px 14px", borderRadius: 8, background: accent, color: MATCHUP_COLORS.bg, fontSize: 12.5, fontWeight: 800, textDecoration: "none" }}
            >새 탭에서 열기</a>
            <a
              href={pdfUrl}
              download
              style={{ padding: "7px 14px", borderRadius: 8, background: "rgba(255,255,255,0.06)", color: MATCHUP_COLORS.textSecondary, fontSize: 12.5, fontWeight: 800, textDecoration: "none", border: `1px solid ${MATCHUP_COLORS.border}` }}
            >다운로드</a>
          </div>
        </div>
      )}

      {/* PDF iframe area */}
      <div style={{ flex: 1, position: "relative", background: "#101827", minHeight: 600 }}>
        {pdfUrl ? (
          <iframe
            src={pdfUrl}
            title={card.title}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: "none", background: "#fff" }}
          />
        ) : (
          <div style={{ padding: 48, textAlign: "center", color: MATCHUP_COLORS.textSecondary, lineHeight: 1.6 }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>!</div>
            <p style={{ fontSize: 14, fontWeight: 800, margin: "0 0 6px", color: MATCHUP_COLORS.textPrimary }}>본문 PDF를 볼 수 없습니다</p>
            <p style={{ fontSize: 12.5, margin: 0 }}>공개 기간이 지났거나 학원에서 비공개 상태로 두었어요.</p>
          </div>
        )}
      </div>
    </MatchupLandingShell>
  );
}
