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
  fetchPublishedHitReportIds,
  toggleHitReportShowcase,
  generateHitReportShareLink,
  type HitReportListItem,
  type HitReportListResponse,
} from "../api/matchup.api";
import HitReportBoardPreviewStrip from "../components/matchup/HitReportBoardPreviewStrip";
import HitReportPreviewModal from "../components/matchup/HitReportPreviewModal";

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
  const [showcaseIds, setShowcaseIds] = useState<Set<number>>(new Set());
  const [togglingId, setTogglingId] = useState<number | null>(null);

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

  // 학원장(owner/admin)만 picker 등록 ID fetch — chip 활성/비활성 표시용
  useEffect(() => {
    if (!isAcademyAdmin) return;
    fetchPublishedHitReportIds().then((ids) => setShowcaseIds(new Set(ids))).catch(() => {});
  }, [isAcademyAdmin]);

  const handleShowcaseToggle = useCallback(async (reportId: number, currentlyOn: boolean) => {
    if (togglingId !== null) return;
    setTogglingId(reportId);
    try {
      const action: "add" | "remove" = currentlyOn ? "remove" : "add";
      await toggleHitReportShowcase(reportId, action);
      setShowcaseIds((prev) => {
        const next = new Set(prev);
        if (action === "add") next.add(reportId);
        else next.delete(reportId);
        return next;
      });
      feedback.success(action === "add" ? "홈페이지에 노출했습니다" : "홈페이지에서 내렸습니다");
    } catch (e) {
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      feedback.error(typeof detail === "string" ? detail : "변경 실패");
    } finally {
      setTogglingId(null);
    }
  }, [togglingId]);

  // 1클릭 공유 링크 복사 (#67, 2026-05-12) — 학원장/선생이 학생/학부모 카톡 share용.
  // backend: 없으면 generate, 있으면 그대로 반환. clipboard에 절대 URL 복사.
  const [sharingId, setSharingId] = useState<number | null>(null);
  // 응답 created flag로 toast 분기 — backend 결과를 사용자에게 정확히 전달.
  const handleShareCopy = useCallback(async (reportId: number) => {
    if (sharingId !== null) return;
    setSharingId(reportId);
    try {
      const resp = await generateHitReportShareLink(reportId);
      if (!resp.share_url) throw new Error("응답에 share_url 없음");
      const absolute = `${window.location.origin}${resp.share_url}`;
      // 응답 성공 이후에만 clipboard 시도. 실패해도 prompt fallback으로 사용자에게 URL 노출.
      let copied = false;
      try {
        await navigator.clipboard.writeText(absolute);
        copied = true;
      } catch {
        window.prompt("공유 링크 (복사해서 카톡으로 보내세요)", absolute);
      }
      // 응답 reload — has_share_token state 갱신.
      void load();
      const msg = resp.created
        ? "공유 링크를 새로 만들고 복사했습니다. 카톡에 붙여넣으면 됩니다."
        : "공유 링크를 복사했습니다. 카톡에 붙여넣으면 됩니다.";
      if (copied) feedback.success(msg);
      else feedback.info("공유 링크가 위 입력창에 표시되었습니다. 직접 복사해 주세요.");
    } catch (e) {
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      feedback.error(typeof detail === "string" ? detail : "공유 링크 생성 실패");
    } finally {
      setSharingId(null);
    }
  }, [sharingId, load]);

  const reports = useMemo(() => data?.reports ?? [], [data]);
  const summary = data?.summary;
  const draftCount = summary?.drafts ?? 0;
  const avgHitRate = summary?.avg_hit_rate ?? 0;

  // 학원장 spec (박철T 2026-05-13): row 클릭 = 무거운 편집기 즉시 진입 X.
  // 먼저 read-only PDF preview modal 띄움 → "수정" 클릭해야 정식 편집기.
  const [previewReport, setPreviewReport] = useState<HitReportListItem | null>(null);

  const handleOpenEditor = useCallback((docId: number) => {
    // 매치업 페이지로 navigate + state로 docId 전달 → MatchupPage가 useEffect로
    // 자동 doc 선택 + HitReportEditor 오픈.
    navigate("/admin/storage/matchup", { state: { openHitReportForDoc: docId } });
    feedback.info("매치업 편집기로 이동합니다.");
  }, [navigate]);

  const handleRowClick = useCallback((report: HitReportListItem) => {
    setPreviewReport(report);
  }, []);

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
                {"  ·  "}총 {summary.total}건 (게시 {summary.submitted} / 작성중 {summary.drafts})
              </span>
            )}
          </div>
        </div>
        <Button size="sm" intent="ghost" onClick={() => void load()} disabled={loading} leftIcon={<RefreshCw size={ICON.sm} />}>
          새로고침
        </Button>
        {/* 학원장 spec (박철T 2026-05-13 라이브): "매치업 페이지에서 작성하기를 누를수있게".
            게시판 페이지로 deep link + 자동 PDF 업로드 모달 open. */}
        {isAcademyAdmin && (
          <>
            <Button size="sm" intent="ghost" onClick={() => navigate("/landing/admin/matchup-board")}>
              게시판 관리
            </Button>
            <Button size="sm" intent="primary" onClick={() => navigate("/landing/admin/matchup-board?compose=upload")}>
              + PDF 업로드 게시
            </Button>
          </>
        )}
      </div>

      {/* 학원장 포탈 widget (2026-05-11) — 작성/관리(admin) ↔ 학원 게시판(landing) 단일 흐름.
          submit/unsubmit 후 자동 reload, 새 게시 카드 ✨ pulse 3초. */}
      {isAcademyAdmin && <HitReportBoardPreviewStrip />}

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
            작성중 {draftCount}건 — 학원 홈페이지 매치업 게시판에 올릴 보고서를 마무리해주세요.
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
          <option value="submitted">홈페이지 게시 중</option>
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
              {tab === "mine" ? "작성한 보고서가 없습니다" : "학원 홈페이지에 게시된 보고서가 없습니다"}
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
                onClick={() => handleRowClick(r)}
                showcaseOn={showcaseIds.has(r.id)}
                showcaseToggling={togglingId === r.id}
                onShowcaseToggle={isAcademyAdmin ? () => handleShowcaseToggle(r.id, showcaseIds.has(r.id)) : undefined}
                onShareCopy={() => handleShareCopy(r.id)}
                shareLoading={sharingId === r.id}
              />
            ))}
          </div>
        )}
      </div>

      {/* read-only PDF preview modal (Phase #70, 2026-05-13) */}
      {previewReport && (
        <HitReportPreviewModal
          report={previewReport}
          open={!!previewReport}
          onClose={() => setPreviewReport(null)}
          onEdit={() => {
            const docId = previewReport.document_id;
            setPreviewReport(null);
            handleOpenEditor(docId);
          }}
        />
      )}
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
  report, showAuthor, onClick, showcaseOn, showcaseToggling, onShowcaseToggle,
  onShareCopy, shareLoading,
}: {
  report: HitReportListItem;
  showAuthor: boolean;
  onClick: () => void;
  showcaseOn?: boolean;
  showcaseToggling?: boolean;
  onShowcaseToggle?: () => void;
  onShareCopy?: () => void;
  shareLoading?: boolean;
}) {
  const shareActive = !!report.has_share_token;
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
      data-testid="hit-report-card"
      data-report-id={report.id}
      data-report-status={report.status}
      aria-label={`${report.title || report.document_title || "(제목 없음)"} — ${isSubmitted ? "게시 중" : "작성 중"}`}
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
              🌐 게시 중
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
          {onShowcaseToggle && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onShowcaseToggle(); }}
              disabled={showcaseToggling}
              title={showcaseOn ? "홈페이지에서 내리기" : "홈페이지에 노출"}
              style={{
                padding: "1px 9px 1px 7px", borderRadius: 999, fontSize: 10, fontWeight: 700,
                background: showcaseOn ? "rgba(37,99,235,0.12)" : "rgba(15,23,42,0.05)",
                color: showcaseOn ? "var(--color-brand-primary, #2563EB)" : "var(--color-text-muted, #94a3b8)",
                border: showcaseOn ? "1px solid rgba(37,99,235,0.3)" : "1px solid transparent",
                cursor: showcaseToggling ? "wait" : "pointer",
                opacity: showcaseToggling ? 0.6 : 1,
                display: "inline-flex", alignItems: "center", gap: 3,
                letterSpacing: "-0.01em",
              }}
            >
              {showcaseOn ? "🌐 홈페이지" : "+ 홈페이지"}
            </button>
          )}
          {onShareCopy && (
            <button
              type="button"
              data-testid="hit-report-share-copy"
              data-share-active={shareActive ? "true" : "false"}
              onClick={(e) => { e.stopPropagation(); onShareCopy(); }}
              disabled={shareLoading}
              title={shareActive
                ? "학생/학부모 카톡 공유 링크 복사 (활성)"
                : "학생/학부모 카톡 공유 링크 만들기 (로그인 없이 즉시 PDF)"
              }
              aria-label={shareActive ? "공유 링크 복사" : "공유 링크 만들기"}
              style={{
                padding: "1px 9px 1px 7px", borderRadius: 999, fontSize: 10, fontWeight: 700,
                background: shareActive ? "rgba(20,184,166,0.22)" : "rgba(20,184,166,0.08)",
                color: "var(--color-teal-700, #0d9488)",
                border: shareActive ? "1px solid rgba(20,184,166,0.55)" : "1px dashed rgba(20,184,166,0.4)",
                cursor: shareLoading ? "wait" : "pointer",
                opacity: shareLoading ? 0.6 : 1,
                display: "inline-flex", alignItems: "center", gap: 3,
                letterSpacing: "-0.01em",
              }}
            >
              🔗 {shareLoading ? "복사 중…" : (shareActive ? "공유 링크" : "공유 링크 만들기")}
            </button>
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
            <span>게시일: {new Date(report.submitted_at).toLocaleDateString("ko-KR")}</span>
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
