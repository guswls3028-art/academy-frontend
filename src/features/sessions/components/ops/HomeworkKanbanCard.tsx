/**
 * 과제 Kanban 카드 — ExamKanbanCard와 레이아웃 일치
 */
import { HomeworkStatusBadge } from "./StatusBadge";

export type HomeworkCardData = {
  id: number;
  title: string;
  status: string;
  closeAt?: string | null;
};

type Props = {
  homework: HomeworkCardData;
  onClick: () => void;
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

export default function HomeworkKanbanCard({ homework, onClick }: Props) {
  const closeUrgent = homework.status === "OPEN" && isWithin24Hours(homework.closeAt);

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
      `}
    >
      {/* Title + badge row */}
      <div className="flex items-start justify-between gap-2">
        <span className="font-medium text-[var(--color-text-primary)] line-clamp-2 flex-1">
          {homework.title}
        </span>
        <HomeworkStatusBadge status={homework.status} className="flex-shrink-0" />
      </div>

      {/* Urgency indicator */}
      {closeUrgent && (
        <div className="mt-1.5 inline-flex items-center gap-1 rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
          마감 임박
        </div>
      )}

      {/* Meta info */}
      {homework.closeAt && (
        <div className="mt-2 space-y-1 text-xs text-[var(--color-text-muted)]">
          <div className={`text-[10px] opacity-80 ${closeUrgent ? "font-medium text-amber-600 dark:text-amber-400 opacity-100" : ""}`}>
            마감 {formatDate(homework.closeAt)}
          </div>
        </div>
      )}

      {/* Hover actions */}
      <div className="mt-3 flex items-center gap-2">
        <span className="rounded border border-[var(--color-border-divider)] px-2 py-1 text-xs opacity-0 transition-opacity group-hover:opacity-100">
          상세
        </span>
        <span className="ml-auto text-[var(--color-text-muted)] opacity-30 transition-opacity group-hover:opacity-0 text-xs">
          →
        </span>
      </div>
    </div>
  );
}
