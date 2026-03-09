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

const STATUS_ORDER: ExamPhaseStatus[] = ["DRAFT", "OPEN", "CLOSED"];

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
    status: row.status ?? "DRAFT",
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
    const s = { draft: 0, open: 0, closed: 0 };
    cards.forEach((c) => {
      if (c.status === "DRAFT") s.draft++;
      else if (c.status === "OPEN") s.open++;
      else s.closed++;
    });
    return s;
  }, [cards]);

  const byStatus = useMemo(() => {
    const map: Record<ExamPhaseStatus, ExamCardDataPhase[]> = {
      DRAFT: [],
      OPEN: [],
      CLOSED: [],
    };
    cards.forEach((c) => map[c.status].push(c));
    return map;
  }, [cards]);

  return { stats, byStatus, isLoading };
}

export default function SessionExamOpsBoard({ lectureId, sessionId, onAddExam }: Props) {
  const navigate = useNavigate();
  const { stats, byStatus, isLoading } = useExamStatsAndGroups(sessionId);

  const basePath = `/admin/lectures/${lectureId}/sessions/${sessionId}/exams`;

  const handleSelect = (examId: number) => {
    navigate(`${basePath}?examId=${examId}`);
  };

  const hasNoExams =
    !isLoading &&
    byStatus.DRAFT.length + byStatus.OPEN.length + byStatus.CLOSED.length === 0;

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
      {hasNoExams && onAddExam && (
        <div
          className="rounded-xl border-2 border-dashed border-[var(--color-border-divider)] bg-[var(--color-bg-surface-soft)] p-8 text-center"
        >
          <p className="mb-2 text-sm font-medium text-[var(--color-text-secondary)]">
            이 차시에 연결된 시험이 없습니다
          </p>
          <p className="mb-4 text-xs text-[var(--color-text-muted)]">
            시험 추가 후 설정 탭에서 기본 설정을 하고 진행하기를 누르면 배포됩니다.
          </p>
          <Button type="button" intent="primary" size="lg" onClick={onAddExam}>
            + 시험 추가
          </Button>
        </div>
      )}
      {!hasNoExams && (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {STATUS_ORDER.map((status) => (
              <div
                key={status}
                className="rounded-lg border border-[var(--color-border-divider)] bg-[var(--color-bg-surface-soft)] p-3"
              >
                <div className="space-y-2">
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
        </>
      )}
    </div>
  );
}
