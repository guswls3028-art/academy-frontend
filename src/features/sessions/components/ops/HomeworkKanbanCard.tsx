/**
 * 과제 Kanban 카드 — 플랫, 호버 시 액션
 */
import { HomeworkStatusBadge } from "./StatusBadge";

export type HomeworkCardData = {
  id: number;
  title: string;
  status: string;
};

type Props = {
  homework: HomeworkCardData;
  onClick: () => void;
};

export default function HomeworkKanbanCard({ homework, onClick }: Props) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => e.key === "Enter" && onClick()}
      className="group cursor-pointer rounded-lg border border-[var(--color-border-divider)] bg-[var(--color-bg-surface)] p-3 text-left transition-colors hover:border-[var(--color-border-strong)] hover:bg-[var(--color-bg-surface-soft)]"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="font-medium text-[var(--color-text-primary)] line-clamp-2">
          {homework.title}
        </span>
        <HomeworkStatusBadge status={homework.status} className="flex-shrink-0" />
      </div>
      <div className="mt-3 opacity-0 transition-opacity group-hover:opacity-100">
        <span className="rounded border border-[var(--color-border-divider)] px-2 py-1 text-xs">
          상세
        </span>
      </div>
    </div>
  );
}
