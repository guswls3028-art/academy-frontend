// PATH: src/app_admin/domains/storage/components/matchup/HitReportBoardPreviewStrip.tsx
//
// HitReportListPage 상단 띠 widget — 학원 홈페이지 매치업 게시판 mini list.
//
// 학원장 mental model 정합 (2026-05-11): 작성/관리(admin) ↔ 학원 게시판(landing) ↔
// 외부 공유 단일 흐름. submit 후 결과 즉시 확인 + cafe 게시판 분위기 + "전체 보기" 1클릭.
//
// reload 신호: window CustomEvent 'matchup:board-preview:refresh' 발사 시 자동 fetch.
// HitReportEditor 의 submit/unsubmit 핸들러에서 발사.
/* eslint-disable no-restricted-syntax */

import { useCallback, useEffect, useState } from "react";
import { ExternalLink, RefreshCw, Sparkles } from "lucide-react";
import { ICON, Button } from "@/shared/ui/ds";
import { useIsMobile } from "@/shared/hooks/useIsMobile";
import {
  fetchHitReportBoardPreview,
  type BoardPreviewCard,
} from "../../api/matchup.api";

type Props = {
  /** 학원장(owner/admin) 권한일 때만 렌더 결정 — 호출 측 책임. */
  open?: boolean;
};

export default function HitReportBoardPreviewStrip({ open = true }: Props) {
  const isMobile = useIsMobile();
  const [cards, setCards] = useState<BoardPreviewCard[]>([]);
  const [totalPublished, setTotalPublished] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recentlyAddedId, setRecentlyAddedId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetchHitReportBoardPreview(5);
      // 새로 추가된 카드 식별 — submit 직후 reload 시 첫 번째 카드가 신규일 가능성 큼.
      const prevIds = new Set(cards.map((c) => c.id));
      const newCard = r.reports.find((c) => !prevIds.has(c.id));
      setCards(r.reports);
      setTotalPublished(r.total_published);
      if (newCard && cards.length > 0) {
        setRecentlyAddedId(newCard.id);
        // 3초 후 pulse 해제
        setTimeout(() => setRecentlyAddedId(null), 3000);
      }
    } catch (e) {
      console.error(e);
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(detail || "게시판 불러오기 실패");
    } finally {
      setLoading(false);
    }
    // cards 비교를 위해 의도적으로 deps 비움 (load 호출 시점에 최신 state 읽음)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  // 외부 reload 신호 — submit/unsubmit 핸들러에서 발사.
  useEffect(() => {
    const handler = () => void load();
    window.addEventListener("matchup:board-preview:refresh", handler);
    return () => window.removeEventListener("matchup:board-preview:refresh", handler);
  }, [load]);

  if (!open) return null;

  return (
    <div
      data-testid="hit-report-board-preview-strip"
      style={{
        border: "1px solid var(--color-border-divider)",
        background: "linear-gradient(135deg, var(--color-bg-elevated, #f8fafc) 0%, var(--color-bg-canvas) 100%)",
        borderRadius: 8,
        padding: isMobile ? "14px" : "12px 14px",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      {/* header */}
      <div style={{
        display: "flex",
        flexDirection: isMobile ? "column" : "row",
        alignItems: isMobile ? "stretch" : "center",
        gap: isMobile ? 10 : 8,
      }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 8, minWidth: 0 }}>
          <span style={{ fontSize: 16, flexShrink: 0 }}>🌐</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "2px 8px",
              fontSize: 13,
              fontWeight: 700,
              lineHeight: 1.45,
              color: "var(--color-text-primary)",
            }}>
              <span>우리 학원 매치업 게시판</span>
              {totalPublished > 0 && (
                <span style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-muted)", whiteSpace: "nowrap" }}>
                  {totalPublished}건 게시 중
                </span>
              )}
            </div>
            <div style={{ fontSize: 11, color: "var(--color-text-muted)", marginTop: 1, lineHeight: 1.5 }}>
              학원장님이 게시판에 올린 보고서가 학부모·외부 방문자에게 노출됩니다.
            </div>
          </div>
        </div>
        <div style={{
          display: isMobile ? "grid" : "flex",
          gridTemplateColumns: isMobile ? "1fr 1fr" : undefined,
          gap: 8,
          width: isMobile ? "100%" : undefined,
        }}>
          <Button
            size="sm"
            intent="ghost"
            onClick={() => void load()}
            disabled={loading}
            leftIcon={<RefreshCw size={ICON.sm} />}
            title="게시판 새로고침"
            style={{ width: isMobile ? "100%" : undefined }}
          >
            {loading ? "갱신 중…" : "새로고침"}
          </Button>
          <Button
            size="sm"
            intent="primary"
            onClick={() => window.open("/landing", "_blank", "noopener,noreferrer")}
            leftIcon={<ExternalLink size={ICON.sm} />}
            title="학원 홈페이지 매치업 게시판 전체 보기 (새 탭)"
            style={{ width: isMobile ? "100%" : undefined }}
          >
            전체 보기
          </Button>
        </div>
      </div>

      {/* body */}
      {error ? (
        <div style={{ fontSize: 12, color: "var(--color-status-error, #dc2626)" }}>
          {error}
        </div>
      ) : cards.length === 0 ? (
        <div
          style={{
            fontSize: 12,
            color: "var(--color-text-muted)",
            padding: "10px 4px",
            lineHeight: 1.6,
          }}
        >
          {loading
            ? "게시판 불러오는 중…"
            : "아직 게시된 보고서가 없어요. 보고서 편집기에서 '🌐 홈페이지에 게시' 버튼을 누르면 이 자리에 카드가 올라옵니다."}
        </div>
      ) : (
        <div
          style={{
            display: "flex",
            gap: 10,
            overflowX: "auto",
            paddingBottom: 4,
            scrollbarWidth: "thin",
          }}
        >
          {cards.map((c) => {
            const isPulse = c.id === recentlyAddedId;
            return (
              <a
                key={c.id}
                href={c.landing_url}
                target="_blank"
                rel="noopener noreferrer"
                title={`${c.title || c.doc_title} · ${c.doc_category} · 적중률 ${c.hit_rate_pct}%`}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                  minWidth: 200,
                  maxWidth: 220,
                  padding: "10px 12px",
                  border: isPulse
                    ? "2px solid var(--color-status-success, #10b981)"
                    : "1px solid var(--color-border-divider)",
                  borderRadius: 6,
                  background: "var(--color-bg-canvas)",
                  textDecoration: "none",
                  color: "inherit",
                  cursor: "pointer",
                  boxShadow: isPulse
                    ? "0 0 0 3px rgba(16, 185, 129, 0.15)"
                    : "none",
                  transition: "all 0.2s",
                  position: "relative",
                }}
              >
                {isPulse && (
                  <span
                    style={{
                      position: "absolute",
                      top: 6,
                      right: 6,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 2,
                      padding: "2px 6px",
                      background: "var(--color-status-success, #10b981)",
                      color: "white",
                      borderRadius: 10,
                      fontSize: 10,
                      fontWeight: 700,
                    }}
                  >
                    <Sparkles size={10} />
                    NEW
                  </span>
                )}
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: "var(--color-text-primary)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {c.title || c.doc_title || `보고서 #${c.id}`}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: "var(--color-text-muted)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {c.doc_category || "—"}
                  {c.author_name && ` · ${c.author_name}`}
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: 11,
                  }}
                >
                  <span
                    style={{
                      padding: "2px 6px",
                      borderRadius: 10,
                      fontWeight: 700,
                      background:
                        c.hit_rate_pct >= 50
                          ? "var(--color-status-success-bg, #d1fae5)"
                          : c.hit_rate_pct >= 25
                          ? "var(--color-brand-primary-bg, #dbeafe)"
                          : "var(--color-bg-elevated, #f1f5f9)",
                      color:
                        c.hit_rate_pct >= 50
                          ? "var(--color-status-success, #059669)"
                          : c.hit_rate_pct >= 25
                          ? "var(--color-brand-primary, #2563eb)"
                          : "var(--color-text-muted)",
                    }}
                  >
                    적중률 {c.hit_rate_pct}%
                  </span>
                  <span style={{ color: "var(--color-text-muted)", fontSize: 10 }}>
                    {c.hit_count}/{c.total_problems}
                  </span>
                </div>
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}
