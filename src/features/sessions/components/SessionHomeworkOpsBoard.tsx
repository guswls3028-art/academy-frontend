/**
 * 차시 과제 운영 보드 — KPI + Kanban (진행 중 / 마감)
 */
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { fetchHomeworks } from "@/features/homework/api/homeworks";
import type { HomeworkListItem } from "@/features/homework/api/homeworks";
import type { HomeworkCardData } from "./ops/HomeworkKanbanCard";
import { Button } from "@/shared/ui/ds";
import HomeworkKanbanCard from "./ops/HomeworkKanbanCard";
import KPICard from "./ops/KPICard";

const HW_STATUS_ORDER = ["OPEN", "CLOSED"] as const;

const COLUMN_LABELS: Record<string, string> = {
  OPEN: "진행 중",
  CLOSED: "마감",
};

type Props = {
  lectureId: number;
  sessionId: number;
  onAddHomework?: () => void;
};

function toCard(item: HomeworkListItem): HomeworkCardData {
  return {
    id: item.id,
    title: item.title,
    status: item.status === "CLOSED" ? "CLOSED" : "OPEN",
  };
}

function useHomeworkStatsAndGroups(sessionId: number) {
  const { data: list = [], isLoading } = useQuery({
    queryKey: ["session-homeworks", sessionId],
    queryFn: () => fetchHomeworks({ session_id: sessionId }),
    enabled: Number.isFinite(sessionId),
  });

  const cards = useMemo(() => list.map(toCard), [list]);

  const stats = useMemo(() => {
    const s = { open: 0, closed: 0 };
    cards.forEach((c) => {
      if (c.status === "CLOSED") s.closed++;
      else s.open++;
    });
    return s;
  }, [cards]);

  const byStatus = useMemo(() => {
    const map: Record<string, HomeworkCardData[]> = {
      OPEN: [],
      CLOSED: [],
    };
    cards.forEach((c) => {
      if (map[c.status]) map[c.status].push(c);
    });
    return map;
  }, [cards]);

  return { stats, byStatus, isLoading, total: cards.length };
}

export default function SessionHomeworkOpsBoard({ lectureId, sessionId, onAddHomework }: Props) {
  const navigate = useNavigate();
  const { stats, byStatus, isLoading, total } = useHomeworkStatsAndGroups(sessionId);

  const basePath = `/admin/lectures/${lectureId}/sessions/${sessionId}/assignments`;

  const handleSelect = (homeworkId: number) => {
    navigate(`${basePath}?homeworkId=${homeworkId}`);
  };

  const hasNoHomeworks =
    !isLoading &&
    (byStatus.OPEN?.length ?? 0) + (byStatus.CLOSED?.length ?? 0) === 0;

  if (isLoading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center text-sm text-[var(--color-text-muted)]">
        불러오는 중…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
            이번 차시 과제 운영 현황
          </h2>
          {onAddHomework && (
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">
              과제를 추가하면 이 차시에 연결됩니다. 좌측 패널 &quot;+ 추가&quot; 또는 아래 버튼으로 생성하세요.
            </p>
          )}
        </div>
        {onAddHomework && (
          <Button type="button" intent="primary" onClick={onAddHomework}>
            + 과제 추가
          </Button>
        )}
      </div>

      {/* KPI stat row */}
      {!hasNoHomeworks && (
        <div className="grid grid-cols-3 gap-3">
          <KPICard label="전체" value={total} color="gray" />
          <KPICard label="진행 중" value={stats.open} color="blue" />
          <KPICard label="마감" value={stats.closed} color="green" />
        </div>
      )}

      {/* Empty state */}
      {hasNoHomeworks && onAddHomework && (
        <div className="rounded-xl border-2 border-dashed border-[var(--color-border-divider)] bg-[var(--color-bg-surface-soft)] p-8 text-center">
          <p className="mb-2 text-sm font-medium text-[var(--color-text-secondary)]">
            이 차시에 연결된 과제가 없습니다
          </p>
          <p className="mb-4 text-xs text-[var(--color-text-muted)]">
            좌측 패널 또는 아래 버튼으로 과제를 추가하세요.
          </p>
          <Button type="button" intent="primary" size="lg" onClick={onAddHomework}>
            + 과제 추가
          </Button>
        </div>
      )}

      {/* Kanban columns */}
      {!hasNoHomeworks && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {HW_STATUS_ORDER.map((status) => (
            <div
              key={status}
              className="rounded-lg border border-[var(--color-border-divider)] bg-[var(--color-bg-surface-soft)] overflow-hidden"
            >
              {/* Column header */}
              <div className="flex items-center justify-between border-b border-[var(--color-border-divider)] px-3 py-2">
                <span className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">
                  {COLUMN_LABELS[status]}
                </span>
                <span className="rounded-full bg-[var(--color-bg-surface)] border border-[var(--color-border-divider)] px-2 py-0.5 text-xs font-medium text-[var(--color-text-muted)]">
                  {byStatus[status]?.length ?? 0}
                </span>
              </div>

              {/* Cards */}
              <div className="space-y-2 p-3">
                {byStatus[status]?.length === 0 ? (
                  <div className="rounded border border-dashed border-[var(--color-border-divider)] py-6 text-center text-xs text-[var(--color-text-muted)]">
                    없음
                  </div>
                ) : (
                  (byStatus[status] ?? []).map((hw) => (
                    <HomeworkKanbanCard
                      key={hw.id}
                      homework={hw}
                      onClick={() => handleSelect(hw.id)}
                    />
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
