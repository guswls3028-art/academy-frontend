/**
 * 차시 과제 운영 보드 — KPI + Kanban
 */
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { fetchHomeworks } from "@/features/homework/api/homeworks";
import type { HomeworkListItem } from "@/features/homework/api/homeworks";
import type { HomeworkCardData } from "./ops/HomeworkKanbanCard";
import KPICard from "./ops/KPICard";
import HomeworkKanbanCard from "./ops/HomeworkKanbanCard";

const HW_STATUS_ORDER = ["DRAFT", "OPEN", "CLOSED"] as const;
const HW_LABEL: Record<string, string> = {
  DRAFT: "초안",
  OPEN: "진행중",
  CLOSED: "완료",
};

type Props = {
  lectureId: number;
  sessionId: number;
};

function toCard(item: HomeworkListItem): HomeworkCardData {
  return {
    id: item.id,
    title: item.title,
    status: item.status,
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
    const s = { draft: 0, open: 0, closed: 0 };
    cards.forEach((c) => {
      if (c.status === "DRAFT") s.draft++;
      else if (c.status === "OPEN") s.open++;
      else s.closed++;
    });
    return s;
  }, [cards]);

  const byStatus = useMemo(() => {
    const map: Record<string, HomeworkCardData[]> = {
      DRAFT: [],
      OPEN: [],
      CLOSED: [],
    };
    cards.forEach((c) => {
      if (map[c.status]) map[c.status].push(c);
    });
    return map;
  }, [cards]);

  return { stats, byStatus, isLoading };
}

export default function SessionHomeworkOpsBoard({ lectureId, sessionId }: Props) {
  const navigate = useNavigate();
  const { stats, byStatus, isLoading } = useHomeworkStatsAndGroups(sessionId);

  const basePath = `/admin/lectures/${lectureId}/sessions/${sessionId}/assignments`;

  const handleSelect = (id: number) => {
    navigate(`${basePath}?homeworkId=${id}`);
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center text-sm text-[var(--color-text-muted)]">
        불러오는 중…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
          이번 차시 과제 운영 현황
        </h2>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <KPICard label="초안" value={stats.draft} color="gray" />
        <KPICard label="진행중" value={stats.open} color="blue" />
        <KPICard label="완료" value={stats.closed} color="green" />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {HW_STATUS_ORDER.map((status) => (
          <div
            key={status}
            className="rounded-lg border border-[var(--color-border-divider)] bg-[var(--color-bg-surface-soft)] p-3"
          >
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
              {HW_LABEL[status]}
            </div>
            <div className="space-y-2">
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
    </div>
  );
}
