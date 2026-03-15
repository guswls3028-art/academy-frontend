/**
 * 차시 시험 운영 보드 — 과제와 동일: 설정 중 / 진행 중 / 마감 3칸
 */
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { fetchAdminSessionExams } from "@/features/results/api/adminSessionExams";
import type { SessionExamRow } from "@/features/results/api/adminSessionExams";
import { type ExamPhaseStatus } from "../utils/examStatus";
import type { ExamCardData } from "./ops/ExamKanbanCard";
import { Button } from "@/shared/ui/ds";
import ExamKanbanCard from "./ops/ExamKanbanCard";
import KPICard from "./ops/KPICard";

const STATUS_ORDER: ExamPhaseStatus[] = ["OPEN", "CLOSED"];

const COLUMN_LABELS: Record<string, string> = {
  OPEN: "진행 중",
  CLOSED: "마감",
};

type Props = {
  lectureId: number;
  sessionId: number;
  onAddExam?: () => void;
};

type ExamCardDataPhase = Omit<ExamCardData, "status"> & { status: ExamPhaseStatus };

function toCard(row: SessionExamRow): ExamCardDataPhase {
  return {
    id: row.exam_id,
    title: row.title ?? "",
    status: (row.status === "CLOSED" ? "CLOSED" : "OPEN") as ExamPhaseStatus,
    enrolled: 0,
    attempted: 0,
    submitted: 0,
    graded: 0,
    closeAt: row.close_at,
  };
}

function useExamStatsAndGroups(sessionId: number) {
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["admin-session-exams", sessionId],
    queryFn: () => fetchAdminSessionExams(sessionId),
    enabled: Number.isFinite(sessionId),
  });

  const cards = useMemo(() => rows.map(toCard), [rows]);

  const stats = useMemo(() => {
    const s = { open: 0, closed: 0 };
    cards.forEach((c) => {
      if (c.status === "CLOSED") s.closed++;
      else s.open++;
    });
    return s;
  }, [cards]);

  const byStatus = useMemo(() => {
    const map: Record<string, ExamCardDataPhase[]> = {
      OPEN: [],
      CLOSED: [],
    };
    cards.forEach((c) => map[c.status].push(c));
    return map;
  }, [cards]);

  return { stats, byStatus, isLoading, total: cards.length };
}

export default function SessionExamOpsBoard({ lectureId, sessionId, onAddExam }: Props) {
  const navigate = useNavigate();
  const { stats, byStatus, isLoading, total } = useExamStatsAndGroups(sessionId);

  const basePath = `/admin/lectures/${lectureId}/sessions/${sessionId}/exams`;

  const handleSelect = (examId: number) => {
    navigate(`${basePath}?examId=${examId}`);
  };

  const hasNoExams =
    !isLoading &&
    byStatus.OPEN.length + byStatus.CLOSED.length === 0;

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
            이번 차시 평가 운영 현황
          </h2>
          {onAddExam && (
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">
              시험을 추가하면 이 차시에 연결됩니다. 좌측 패널 &quot;+ 추가&quot; 또는 아래 버튼으로 생성하세요.
            </p>
          )}
        </div>
        {onAddExam && (
          <Button type="button" intent="primary" onClick={onAddExam}>
            + 시험 추가
          </Button>
        )}
      </div>

      {/* KPI stat row */}
      {!hasNoExams && (
        <div className="grid grid-cols-3 gap-3">
          <KPICard label="전체" value={total} color="gray" />
          <KPICard label="진행 중" value={stats.open} color="blue" />
          <KPICard label="마감" value={stats.closed} color="green" />
        </div>
      )}

      {/* Empty state */}
      {hasNoExams && onAddExam && (
        <div className="rounded-xl border-2 border-dashed border-[var(--color-border-divider)] bg-[var(--color-bg-surface-soft)] p-8 text-center">
          <p className="mb-2 text-sm font-medium text-[var(--color-text-secondary)]">
            이 차시에 연결된 시험이 없습니다
          </p>
          <p className="mb-4 text-xs text-[var(--color-text-muted)]">
            시험을 추가하면 바로 진행됩니다. 종료하려면 종료하기를 눌러주세요.
          </p>
          <Button type="button" intent="primary" size="lg" onClick={onAddExam}>
            + 시험 추가
          </Button>
        </div>
      )}

      {/* Kanban columns */}
      {!hasNoExams && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {STATUS_ORDER.map((status) => (
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
                  {byStatus[status].length}
                </span>
              </div>

              {/* Cards */}
              <div className="space-y-2 p-3">
                {byStatus[status].length === 0 ? (
                  <div className="rounded border border-dashed border-[var(--color-border-divider)] py-6 text-center text-xs text-[var(--color-text-muted)]">
                    없음
                  </div>
                ) : (
                  byStatus[status].map((exam) => (
                    <ExamKanbanCard
                      key={exam.id}
                      exam={exam}
                      onClick={() => handleSelect(exam.id)}
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
