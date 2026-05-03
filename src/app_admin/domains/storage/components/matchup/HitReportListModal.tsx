// PATH: src/app_admin/domains/storage/components/matchup/HitReportListModal.tsx
// 강사 1인의 매치업 적중 보고서 누적 리스트 — 수업 히스토리/제출 KPI/홍보물 진입점.
//
// 정체성:
//   매치업 보고서는 강사 1인 포트폴리오. 본인이 작성한 모든 보고서를 한 화면에서 누적 검토.
//   admin/owner는 학원 전체 보고서 inbox로도 사용 (강사별 평가 input).
//
// 동선:
//   MatchupPage 도구바 → "내 보고서" 버튼 → 이 모달 → 행 클릭 → HitReportEditor
//
// 진행률·통산 평균은 백엔드 list endpoint가 산출. 통산 적중률(sim>=0.75)은 PDF에서.
/* eslint-disable no-restricted-syntax */

import { useEffect, useState, useCallback, useMemo } from "react";
import { X, FileText, Filter, RefreshCw } from "lucide-react";
import { ICON, Button } from "@/shared/ui/ds";
import { feedback } from "@/shared/ui/feedback/feedback";
import {
  fetchHitReportList,
  type HitReportListItem,
  type HitReportListResponse,
} from "../../api/matchup.api";

type Props = {
  /** admin/owner 여부 — true면 "전체 학원 보고서" 토글 노출. */
  isAdmin: boolean;
  onClose: () => void;
  /** 행 클릭 시 해당 보고서를 편집기에서 열기 — MatchupPage가 docId 기준 라우팅. */
  onOpen: (docId: number) => void;
};

type Tab = "mine" | "all";
type StatusFilter = "" | "draft" | "submitted";

export default function HitReportListModal({ isAdmin, onClose, onOpen }: Props) {
  const [tab, setTab] = useState<Tab>(isAdmin ? "all" : "mine");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("");
  const [data, setData] = useState<HitReportListResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await fetchHitReportList({
        mine: tab === "mine",
        status: statusFilter || undefined,
      });
      setData(resp);
    } catch (e) {
      console.error(e);
      setError(
        (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
          || "보고서 목록 조회 실패",
      );
    } finally {
      setLoading(false);
    }
  }, [tab, statusFilter]);

  useEffect(() => { void load(); }, [load]);

  // ESC = 닫기
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // useMemo로 array identity 안정화 — react-hooks/exhaustive-deps 경고 회피.
  const reports = useMemo(() => data?.reports ?? [], [data]);
  const summary = data?.summary;

  // 강사 통산 작성률 = 모든 보고서의 curated_progress 평균. 작성 KPI.
  const avgProgress = useMemo(() => {
    if (reports.length === 0) return 0;
    const sum = reports.reduce((acc, r) => acc + (r.curated_progress || 0), 0);
    return sum / reports.length;
  }, [reports]);

  // 통산 적중률 = backend에서 산출한 sim≥0.75 비율 누적. 강사 KPI 1순위.
  const avgHitRate = summary?.avg_hit_rate ?? 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="매치업 적중 보고서 목록"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: "fixed", inset: 0,
        background: "rgba(15,23,42,0.55)", zIndex: 110,
        display: "flex", alignItems: "stretch", justifyContent: "center",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(1100px, 95vw)", height: "min(85vh, 800px)",
          margin: "auto 0",
          background: "var(--color-bg-canvas)",
          borderRadius: 8, overflow: "hidden",
          display: "flex", flexDirection: "column",
          boxShadow: "0 24px 48px rgba(15,23,42,0.32)",
        }}
      >
        {/* 헤더 */}
        <div style={{
          padding: "14px 20px",
          borderBottom: "1px solid var(--color-border-divider)",
          background: "var(--color-bg-surface)",
          display: "flex", alignItems: "center", gap: 12,
          flexShrink: 0,
        }}>
          <FileText size={ICON.md} color="var(--color-status-success)" />
          <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--color-text-primary)" }}>
              매치업 적중 보고서
              {summary && reports.length > 0 && summary.total_exam > 0 && (
                <span style={{
                  marginLeft: 10,
                  fontSize: 13, fontWeight: 700,
                  color: avgHitRate >= 50 ? "var(--color-status-success)"
                    : avgHitRate >= 25 ? "var(--color-brand-primary)"
                    : "var(--color-text-muted)",
                }}>
                  통산 적중률 {avgHitRate.toFixed(1)}%
                </span>
              )}
            </div>
            <div style={{ fontSize: 11, color: "var(--color-text-muted)" }}>
              {tab === "mine" ? "내가 작성한 보고서" : "학원 전체 보고서"}
              {summary && (
                <span>
                  {"  ·  "}
                  총 {summary.total}건 (제출 {summary.submitted} / 작성중 {summary.drafts})
                  {reports.length > 0 && (
                    <>
                      {"  ·  "}평균 작성률 {avgProgress.toFixed(0)}%
                      {summary.total_exam > 0 && (
                        <>{"  ·  "}적중 {summary.total_hit}/{summary.total_exam}문항</>
                      )}
                    </>
                  )}
                </span>
              )}
            </div>
          </div>
          <Button size="sm" intent="ghost" onClick={() => void load()} disabled={loading}>
            <RefreshCw size={ICON.xs} style={{ marginRight: 4 }} />
            새로고침
          </Button>
          <button
            onClick={onClose}
            aria-label="닫기"
            style={{
              border: "none", background: "transparent",
              cursor: "pointer", padding: 6, color: "var(--color-text-secondary)",
            }}
          >
            <X size={ICON.md} />
          </button>
        </div>

        {/* 필터 바 */}
        <div style={{
          padding: "10px 20px",
          borderBottom: "1px solid var(--color-border-divider)",
          background: "var(--color-bg-surface-soft)",
          display: "flex", alignItems: "center", gap: 8,
          flexShrink: 0, flexWrap: "wrap",
        }}>
          {isAdmin && (
            <div style={{ display: "flex", border: "1px solid var(--color-border-divider)", borderRadius: 6, overflow: "hidden" }}>
              <TabBtn active={tab === "mine"} onClick={() => setTab("mine")}>내 보고서</TabBtn>
              <TabBtn active={tab === "all"} onClick={() => setTab("all")}>전체 (학원장 inbox)</TabBtn>
            </div>
          )}
          <Filter size={ICON.sm} color="var(--color-text-muted)" style={{ marginLeft: 4 }} />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            style={{
              fontSize: 12, padding: "5px 8px",
              border: "1px solid var(--color-border-divider)",
              borderRadius: 4,
              background: "var(--color-bg-canvas)",
              color: "var(--color-text-primary)",
            }}
          >
            <option value="">상태: 전체</option>
            <option value="draft">작성 중</option>
            <option value="submitted">제출 완료</option>
          </select>
        </div>

        {/* 본문 */}
        <div style={{ flex: 1, overflow: "auto", padding: 12 }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: "center", color: "var(--color-text-secondary)" }}>
              불러오는 중...
            </div>
          ) : error ? (
            <div style={{ padding: 40, textAlign: "center", color: "var(--color-status-error, #dc2626)" }}>
              {error}
              <div style={{ marginTop: 12 }}>
                <Button size="sm" intent="primary" onClick={() => void load()}>다시 시도</Button>
              </div>
            </div>
          ) : reports.length === 0 ? (
            <div style={{
              padding: 40, textAlign: "center",
              color: "var(--color-text-secondary)", fontSize: 13, lineHeight: 1.6,
            }}>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6, color: "var(--color-text-primary)" }}>
                {tab === "mine" ? "작성한 보고서가 없습니다" : "학원에 제출된 보고서가 없습니다"}
              </div>
              <div style={{ fontSize: 12 }}>
                매치업 페이지에서 시험지 자료를 선택 → 적중 보고서 작성 버튼을 누르세요.
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {reports.map((r) => (
                <ReportRow
                  key={r.id}
                  report={r}
                  showAuthor={tab === "all"}
                  onClick={() => {
                    onOpen(r.document_id);
                    feedback.info(`${r.document_title || "시험지"} 보고서 열기`);
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TabBtn({
  active, children, onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "5px 12px", fontSize: 12, fontWeight: 700,
        border: "none",
        background: active ? "var(--color-brand-primary)" : "transparent",
        color: active ? "white" : "var(--color-text-secondary)",
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

function ReportRow({
  report, showAuthor, onClick,
}: {
  report: HitReportListItem;
  showAuthor: boolean;
  onClick: () => void;
}) {
  const isSubmitted = report.status === "submitted";
  const progress = report.curated_progress || 0;
  const hitRate = report.hit_rate || 0;
  const progressColor =
    progress >= 80 ? "var(--color-status-success)" :
    progress >= 40 ? "var(--color-brand-primary)" :
    "var(--color-text-muted)";
  // 적중률 색상 — PDF 표지 헤드라인과 동일 임계값 (≥50% green / ≥25% blue).
  const hitColor =
    hitRate >= 50 ? "var(--color-status-success)" :
    hitRate >= 25 ? "var(--color-brand-primary)" :
    "var(--color-text-muted)";

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      style={{
        padding: "12px 14px",
        border: "1px solid var(--color-border-divider)",
        borderRadius: 6,
        background: "var(--color-bg-canvas)",
        cursor: "pointer",
        display: "flex", alignItems: "center", gap: 12,
        transition: "background 0.12s, border-color 0.12s",
      }}
      onMouseOver={(e) => {
        (e.currentTarget as HTMLDivElement).style.background = "var(--color-bg-active)";
      }}
      onMouseOut={(e) => {
        (e.currentTarget as HTMLDivElement).style.background = "var(--color-bg-canvas)";
      }}
    >
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: "var(--color-text-primary)" }}>
            {report.title || report.document_title || "(제목 없음)"}
          </span>
          {isSubmitted ? (
            <span style={{
              padding: "1px 8px", borderRadius: 999, fontSize: 10, fontWeight: 700,
              background: "var(--color-status-success-bg, #dcfce7)",
              color: "var(--color-status-success)",
            }}>
              제출 완료
            </span>
          ) : (
            <span style={{
              padding: "1px 8px", borderRadius: 999, fontSize: 10, fontWeight: 700,
              background: "var(--color-status-warning-bg, #fef3c7)",
              color: "var(--color-status-warning, #d97706)",
            }}>
              작성 중
            </span>
          )}
        </div>
        <div style={{
          display: "flex", gap: 12, fontSize: 11,
          color: "var(--color-text-muted)", flexWrap: "wrap",
        }}>
          {report.document_category && <span>{report.document_category}</span>}
          {showAuthor && report.author_name && (
            <span>강사: {report.author_name}</span>
          )}
          <span>문항 {report.exam_count}개</span>
          <span>작성 {report.curated_count}/{report.exam_count}</span>
          {report.exam_count > 0 && (
            <span style={{ color: hitColor, fontWeight: 700 }}>
              적중 {report.hit_count}/{report.exam_count} ({hitRate.toFixed(0)}%)
            </span>
          )}
          {report.submitted_at && (
            <span>제출: {new Date(report.submitted_at).toLocaleDateString("ko-KR")}</span>
          )}
        </div>
      </div>

      {/* 진행률 게이지 */}
      <div style={{
        width: 90, display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-end",
        flexShrink: 0,
      }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: progressColor }}>
          {progress.toFixed(0)}%
        </span>
        <div style={{
          width: "100%", height: 4, borderRadius: 2,
          background: "var(--color-bg-surface-soft)", overflow: "hidden",
        }}>
          <div style={{
            width: `${progress}%`, height: "100%",
            background: progressColor, transition: "width 0.2s",
          }} />
        </div>
        <span style={{ fontSize: 9, color: "var(--color-text-muted)" }}>
          작성 진행률
        </span>
      </div>
    </div>
  );
}
