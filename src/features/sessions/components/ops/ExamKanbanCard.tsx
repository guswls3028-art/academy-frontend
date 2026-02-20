/**
 * 시험 Kanban 카드 — 플랫, 호버 시 액션 노출
 */
import type { ExamStatus } from "../../utils/examStatus";
import { ExamStatusBadge } from "./StatusBadge";

export type ExamCardData = {
  id: number;
  title: string;
  status: ExamStatus;
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

export default function ExamKanbanCard({ exam, onClick, isUrgent }: Props) {
  const hasUngraded = exam.submitted > exam.graded;
  const urgent = isUrgent ?? (exam.status === "grading" && hasUngraded);

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
        ${urgent ? "border-amber-500/50 bg-amber-500/5 hover:bg-amber-500/10" : ""}
      `}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="font-medium text-[var(--color-text-primary)] line-clamp-2">
          {exam.title}
        </span>
        <ExamStatusBadge status={exam.status} className="flex-shrink-0" />
      </div>

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
          <div className="text-[10px] opacity-80">마감 {formatDate(exam.closeAt)}</div>
        )}
      </div>

      <div className="mt-3 flex gap-2 opacity-0 transition-opacity group-hover:opacity-100">
        <span className="rounded border border-[var(--color-border-divider)] px-2 py-1 text-xs">
          상세
        </span>
        {exam.status === "grading" && hasUngraded && (
          <span className="rounded border border-amber-500/50 bg-amber-500/10 px-2 py-1 text-xs text-amber-700 dark:text-amber-300">
            채점하기
          </span>
        )}
      </div>
    </div>
  );
}
