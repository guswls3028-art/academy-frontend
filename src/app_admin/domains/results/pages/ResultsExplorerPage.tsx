/**
 * PATH: src/app_admin/domains/results/pages/ResultsExplorerPage.tsx
 *
 * 성적 도메인 「오늘의 작업」 탭 — KPI 인박스 + 채점 대기/완료 인박스
 * 부모 ResultsDomainLayout 이 제목/탭을 제공한다.
 */
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { KPI } from "@/shared/ui/ds";
import {
  fetchResultsLandingStats,
  type LandingSubmissionSummary,
} from "../api/landingStats";
import DashboardWidget from "@admin/domains/dashboard/components/DashboardWidget";

export default function ResultsExplorerPage() {
  const navigate = useNavigate();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin-results-landing-stats"],
    queryFn: fetchResultsLandingStats,
    staleTime: 60_000,
  });

  const fmt = (n: number | undefined): string => {
    if (isError) return "—";
    if (isLoading || n == null) return "…";
    return `${n}건`;
  };

  return (
    <div className="flex flex-col gap-6" style={{ padding: 0 }}>
      {/* 1) 요약 지표 — 클릭으로 액션 진입 */}
      <DashboardWidget title="요약 지표" description="성적 운영 현황">
        <div
          style={{
            display: "grid",
            gap: "var(--space-3)",
            gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
          }}
          data-testid="results-kpi-grid"
        >
          <KPI
            label="채점 대기"
            value={fmt(data?.pending_submissions)}
            hint={data?.failed_last_24h ? `최근 24시간 실패 ${data.failed_last_24h}건` : undefined}
            onClick={() => navigate("/admin/results/submissions")}
            ariaLabel="채점 대기 인박스로 이동"
          />
          <KPI
            label="최근 7일 채점 완료"
            value={fmt(data?.done_last_7d)}
            onClick={() => navigate("/admin/results/submissions")}
            ariaLabel="제출 인박스로 이동"
          />
          <KPI
            label="운영 중 시험"
            value={fmt(data?.active_exams)}
            onClick={() => navigate("/admin/exams")}
            ariaLabel="시험 목록으로 이동"
          />
          <KPI
            label="운영 강의"
            value={fmt(data?.active_lectures)}
            onClick={() => navigate("/admin/lectures")}
            ariaLabel="강의 목록으로 이동"
          />
        </div>
      </DashboardWidget>

      {/* 2) 채점 대기 인박스 — 즉시 처리 */}
      <DashboardWidget
        title="채점 대기 제출"
        description={
          isError
            ? "불러오기 실패"
            : (data?.pending_submissions ?? 0) === 0
              ? "대기 중인 제출이 없습니다."
              : `${data?.pending_top.length ?? 0}건 표시 (총 ${data?.pending_submissions ?? 0}건)`
        }
      >
        {(data?.pending_top.length ?? 0) > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }} data-testid="results-pending-inbox">
            {data!.pending_top.map((s) => (
              <SubmissionRow
                key={s.id}
                sub={s}
                onClick={() => navigate("/admin/results/submissions")}
                rightLabel="채점하기"
              />
            ))}
            {(data?.pending_submissions ?? 0) > (data?.pending_top.length ?? 0) && (
              <button
                type="button"
                onClick={() => navigate("/admin/results/submissions")}
                style={{
                  alignSelf: "flex-start",
                  marginTop: 4,
                  padding: "6px 12px",
                  fontSize: 13,
                  fontWeight: 600,
                  color: "var(--color-primary)",
                  background: "transparent",
                  border: "1px solid var(--color-border-divider)",
                  borderRadius: 8,
                  cursor: "pointer",
                }}
              >
                전체 보기 →
              </button>
            )}
          </div>
        ) : null}
      </DashboardWidget>

      {/* 3) 최근 채점 완료 — 결과 확인 */}
      <DashboardWidget
        title="최근 채점 완료"
        description={
          isError
            ? "불러오기 실패"
            : (data?.recent_done_top.length ?? 0) === 0
              ? "최근 7일 내 완료된 채점이 없습니다."
              : `최근 ${data?.recent_done_top.length ?? 0}건`
        }
      >
        {(data?.recent_done_top.length ?? 0) > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }} data-testid="results-done-inbox">
            {data!.recent_done_top.map((s) => (
              <SubmissionRow
                key={s.id}
                sub={s}
                onClick={() => {
                  if (s.target_type === "exam" && s.lecture_id && s.session_id) {
                    navigate(`/admin/lectures/${s.lecture_id}/sessions/${s.session_id}/scores`);
                  } else {
                    navigate("/admin/results/submissions");
                  }
                }}
                rightLabel="결과 보기"
              />
            ))}
          </div>
        ) : null}
      </DashboardWidget>
    </div>
  );
}

function formatSubmissionTime(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${mm}/${dd} ${hh}:${mi}`;
}

function SubmissionRow({
  sub,
  onClick,
  rightLabel,
}: {
  sub: LandingSubmissionSummary;
  onClick: () => void;
  rightLabel: string;
}) {
  // 제목 폴백: 강의명 또는 제출 시각으로 구분 보조 — 동일 제목·"(제목 없음)" 다수 노출 시 식별성 회복
  const titleText = useMemo(() => {
    if (sub.target_title) return sub.target_title;
    if (sub.lecture_title) return `${sub.lecture_title} · 제목 미입력`;
    return "(제목 없음)";
  }, [sub]);

  const subtitle = useMemo(() => {
    const parts: string[] = [];
    parts.push(sub.student_name || "학생 미식별");
    if (sub.lecture_title && sub.target_title) parts.push(sub.lecture_title);
    const t = formatSubmissionTime(sub.created_at);
    if (t) parts.push(t);
    return parts.join(" · ");
  }, [sub]);

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
        width: "100%",
        padding: "12px 16px",
        cursor: "pointer",
        background: "var(--color-bg-surface-soft, #f9fafb)",
        border: "1px solid var(--color-border-divider)",
        borderRadius: 10,
        font: "inherit",
        color: "inherit",
        textAlign: "left",
        transition: "background 120ms ease, border-color 120ms ease",
      }}
    >
      <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0, flex: 1 }}>
        <span
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: "var(--color-text-primary)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {titleText}
        </span>
        {subtitle && (
          <span
            style={{
              fontSize: 12,
              color: "var(--color-text-muted)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {subtitle}
          </span>
        )}
      </span>
      <span
        style={{
          flexShrink: 0,
          fontSize: 14,
          fontWeight: 700,
          color: "var(--color-primary)",
          letterSpacing: "-0.01em",
        }}
      >
        {rightLabel} →
      </span>
    </button>
  );
}
