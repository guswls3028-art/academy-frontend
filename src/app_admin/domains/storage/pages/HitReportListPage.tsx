// PATH: src/app_admin/domains/storage/pages/HitReportListPage.tsx
// 적중 보고서 독립 페이지 — sidebar 직접 진입.
//
// P1 (2026-05-04): 박철 학원장 매치업 활용 분석 결과 발견 — HitReport sidebar 부재로
// 발견성 0. 5 draft / 1 submitted 상태에서 학원장이 진행 상황 인지 어려움.
// 이 페이지는 sidebar "적중 보고서" 메뉴로 진입 + 카드 리스트 + alert banner로
// draft 인지 + 클릭 시 매치업 페이지 + 편집기 자동 오픈.
/* eslint-disable no-restricted-syntax */

import { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { FileText, Filter, RefreshCw, AlertTriangle } from "lucide-react";
import { ICON, Button } from "@/shared/ui/ds";
import { feedback } from "@/shared/ui/feedback/feedback";
import useAuth from "@/auth/hooks/useAuth";
import {
  fetchHitReportList,
  type HitReportListItem,
  type HitReportListResponse,
} from "../api/matchup.api";

type Tab = "mine" | "all";
type StatusFilter = "" | "draft" | "submitted";

export default function HitReportListPage() {
  const navigate = useNavigate();
  useQueryClient();  // 캐시 무효화 시 사용 가능 (현재는 직접 invalidate X)
  const { user } = useAuth();
  const isAcademyAdmin = !!(
    user?.is_superuser
    || user?.tenantRole === "owner"
    || user?.tenantRole === "admin"
  );

  const [tab, setTab] = useState<Tab>(isAcademyAdmin ? "all" : "mine");
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

  const reports = useMemo(() => data?.reports ?? [], [data]);
  const summary = data?.summary;
  const draftCount = summary?.drafts ?? 0;
  const avgHitRate = summary?.avg_hit_rate ?? 0;

  const handleOpen = useCallback((docId: number) => {
    // 매치업 페이지로 navigate + state로 docId 전달 → MatchupPage가 useEffect로
    // 자동 doc 선택 + HitReportEditor 오픈.
    navigate("/admin/storage/matchup", { state: { openHitReportForDoc: docId } });
    feedback.info("매치업 편집기로 이동합니다.");
  }, [navigate]);

  return (
    <div style={{
      maxWidth: 1100, margin: "0 auto", padding: "20px 24px",
      display: "flex", flexDirection: "column", gap: 16,
    }}>
      {/* 헤더 */}
      <div style={{
        display: "flex", alignItems: "center", gap: 12,
        paddingBottom: 12, borderBottom: "1px solid var(--color-border-divider)",
      }}>
        <FileText size={ICON.lg} color="var(--color-status-success)" />
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: "var(--color-text-primary)" }}>
            적중 보고서
            {summary && reports.length > 0 && summary.total_exam > 0 && (
              <span style={{
                marginLeft: 12, fontSize: 14, fontWeight: 700,
                color: avgHitRate >= 50 ? "var(--color-status-success)"
                  : avgHitRate >= 25 ? "var(--color-brand-primary)"
                  : "var(--color-text-muted)",
              }}>
                통산 적중률 {avgHitRate.toFixed(1)}%
              </span>
            )}
          </h1>
          <div style={{ fontSize: 12, color: "var(--color-text-muted)", marginTop: 2 }}>
            {tab === "mine" ? "내가 작성한 보고서" : "학원 전체 보고서"}
            {summary && (
              <span>
                {"  ·  "}총 {summary.total}건 (제출 {summary.submitted} / 작성중 {summary.drafts})
              </span>
            )}
          </div>
        </div>
        <Button size="sm" intent="ghost" onClick={() => void load()} disabled={loading}>
          <RefreshCw size={ICON.xs} style={{ marginRight: 4 }} />
          새로고침
        </Button>
      </div>

      {/* Draft alert banner — 학원장 시각 인지 자극 */}
      {draftCount > 0 && (
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "10px 14px",
          background: "var(--color-status-warning-bg, #fef3c7)",
          border: "1px solid var(--color-status-warning, #fbbf24)",
          borderRadius: 6,
          color: "var(--color-status-warning, #d97706)",
          fontSize: 13, fontWeight: 700,
        }}>
          <AlertTriangle size={ICON.sm} />
          <span style={{ flex: 1 }}>
            작성중 {draftCount}건 — 학원장님께 보여드릴 적중 보고서를 마무리해주세요.
          </span>
        </div>
      )}

      {/* 필터 바 */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
      }}>
        {isAcademyAdmin && (
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
      <div>
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
            <div style={{ marginTop: 16 }}>
              <Button size="sm" intent="primary" onClick={() => navigate("/admin/storage/matchup")}>
                매치업 페이지 이동
              </Button>
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {reports.map((r) => (
              <ReportRow
                key={r.id}
                report={r}
                showAuthor={tab === "all"}
                onClick={() => handleOpen(r.document_id)}
              />
            ))}
          </div>
        )}
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
