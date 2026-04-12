/**
 * 시험 Kanban 카드 — 플랫, 호버 시 액션 노출
 * status: DRAFT/OPEN/CLOSED(운영 보드) 또는 draft/open/grading/completed(기존)
 */
import type { ExamStatus } from "../../utils/examStatus";
import { ExamStatusBadge, HomeworkStatusBadge } from "./StatusBadge";

export type ExamCardData = {
  id: number;
  title: string;
  status: ExamStatus | "DRAFT" | "OPEN" | "CLOSED";
  enrolled: number;
  attempted: number;
  submitted: number;
  graded: number;
  avgScore?: number | null;
  closeAt?: string | null;
};

type Props = {
  exam: ExamCardData;
  onClick: () => void;
  isUrgent?: boolean;
};

function formatDate(s: string | null | undefined) {
  if (!s) return null;
  const d = new Date(s);
  return d.toLocaleDateString("ko-KR", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isWithin24Hours(dateStr: string | null | undefined): boolean {
  if (!dateStr) return false;
  const diff = new Date(dateStr).getTime() - Date.now();
  return diff > 0 && diff <= 24 * 60 * 60 * 1000;
}

export default function ExamKanbanCard({ exam, onClick, isUrgent }: Props) {
  const hasUngraded = exam.submitted > exam.graded;
  const isPhaseStatus = exam.status === "DRAFT" || exam.status === "OPEN" || exam.status === "CLOSED";
  const closeUrgent = exam.status === "OPEN" && isWithin24Hours(exam.closeAt);
  const urgent = isUrgent ?? closeUrgent ?? (!isPhaseStatus && exam.status === "grading" && hasUngraded);

  const showProgress = exam.graded > 0 && exam.submitted > 0;
  const progressPct = showProgress ? Math.round((exam.graded / exam.submitted) * 100) : 0;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => e.key === "Enter" && onClick()}
      className={`
        group cursor-pointer rounded-lg border p-3 text-left transition-colors
        bg-[var(--color-bg-surface)] border-[var(--color-border-divider)]
        hover:border-[var(--color-border-strong)] hover:bg-[var(--color-bg-surface-soft)]
        ${closeUrgent ? "border-amber-500/50 bg-amber-500/5 hover:bg-amber-500/10" : ""}
        ${!closeUrgent && urgent ? "border-amber-500/50 bg-amber-500/5 hover:bg-amber-500/10" : ""}
      `}
    >
      {/* Title + badge row */}
      <div className="flex items-start justify-between gap-2">
        <span className="font-medium text-[var(--color-text-primary)] line-clamp-2 flex-1">
          {exam.title}
        </span>
        {isPhaseStatus ? (
          <HomeworkStatusBadge status={exam.status} className="flex-shrink-0" />
        ) : (
          <ExamStatusBadge status={exam.status as ExamStatus} className="flex-shrink-0" />
        )}
      </div>

      {/* Urgency indicator */}
      {closeUrgent && (
        <div className="mt-1.5 inline-flex items-center gap-1 rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
          마감 임박
        </div>
      )}

      {/* Meta info */}
      <div className="mt-2 space-y-1 text-xs text-[var(--color-text-muted)]">
        {(exam.enrolled > 0 || exam.attempted > 0) && (
          <div>응시: {exam.attempted}/{exam.enrolled}</div>
        )}
        {exam.submitted > 0 && <div>제출: {exam.submitted}</div>}
        {hasUngraded && (
          <div className={urgent ? "font-medium text-amber-600 dark:text-amber-400" : ""}>
            미채점: {exam.submitted - exam.graded}
          </div>
        )}
        {exam.status === "completed" && exam.avgScore != null && (
          <div>평균: {exam.avgScore}</div>
        )}
        {exam.closeAt && (
          <div className={`text-[10px] opacity-80 ${closeUrgent ? "font-medium text-amber-600 dark:text-amber-400 opacity-100" : ""}`}>
            마감 {formatDate(exam.closeAt)}
          </div>
        )}
      </div>

      {/* Progress bar */}
      {showProgress && (
        <div className="mt-2">
          <div className="flex items-center justify-between text-[10px] text-[var(--color-text-muted)] mb-0.5">
            <span>채점 진행</span>
            <span>{exam.graded}/{exam.submitted}</span>
          </div>
          <div className="h-1 w-full rounded-full bg-[var(--color-border-divider)] overflow-hidden">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      )}

      {/* Hover actions — always render, show subtle arrow at rest, full actions on hover */}
      <div className="mt-3 flex items-center gap-2">
        <span className="rounded border border-[var(--color-border-divider)] px-2 py-1 text-xs opacity-0 transition-opacity group-hover:opacity-100">
          상세
        </span>
        {exam.status === "grading" && hasUngraded && (
          <span className="rounded border border-amber-500/50 bg-amber-500/10 px-2 py-1 text-xs text-amber-700 dark:text-amber-300 opacity-0 transition-opacity group-hover:opacity-100">
            채점하기
          </span>
        )}
        <span className="ml-auto text-[var(--color-text-muted)] opacity-30 transition-opacity group-hover:opacity-0 text-xs">
          →
        </span>
      </div>
    </div>
  );
}
