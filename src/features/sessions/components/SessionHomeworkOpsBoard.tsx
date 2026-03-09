/**
 * 차시 과제 운영 보드 — KPI + Kanban
 */
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { fetchHomeworks } from "@/features/homework/api/homeworks";
import type { HomeworkListItem } from "@/features/homework/api/homeworks";
import type { HomeworkCardData } from "./ops/HomeworkKanbanCard";
import { Button } from "@/shared/ui/ds";
import HomeworkKanbanCard from "./ops/HomeworkKanbanCard";

const HW_STATUS_ORDER = ["DRAFT", "OPEN", "CLOSED"] as const;

type Props = {
  lectureId: number;
  sessionId: number;
  /** 메인 영역에서 과제 추가 모달 열기 (좌측 패널과 동일 모달) */
  onAddHomework?: () => void;
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

export default function SessionHomeworkOpsBoard({ lectureId, sessionId, onAddHomework }: Props) {
  const navigate = useNavigate();
  const { stats, byStatus, isLoading } = useHomeworkStatsAndGroups(sessionId);

  const basePath = `/admin/lectures/${lectureId}/sessions/${sessionId}/assignments`;

  const handleSelect = (id: number) => {
    navigate(`${basePath}?homeworkId=${id}`);
  };

  const hasNoHomeworks =
    !isLoading &&
    (byStatus.DRAFT?.length ?? 0) + (byStatus.OPEN?.length ?? 0) + (byStatus.CLOSED?.length ?? 0) === 0;

  if (isLoading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center text-sm text-[var(--color-text-muted)]">
        불러오는 중…
      </div>
    );
  }

  return (
    <div className="space-y-6">
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
      {hasNoHomeworks && onAddHomework && (
        <div
          className="rounded-xl border-2 border-dashed border-[var(--color-border-divider)] bg-[var(--color-bg-surface-soft)] p-8 text-center"
        >
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
      {!hasNoHomeworks && (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {HW_STATUS_ORDER.map((status) => (
          <div
            key={status}
            className="rounded-lg border border-[var(--color-border-divider)] bg-[var(--color-bg-surface-soft)] p-3"
          >
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
        </>
      )}
    </div>
  );
}
