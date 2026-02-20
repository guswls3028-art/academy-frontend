/**
 * 차시 시험 운영 보드 — KPI + Kanban, 상태별 분류
 */
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { fetchAdminSessionExams } from "@/features/results/api/adminSessionExams";
import type { SessionExamRow } from "@/features/results/api/adminSessionExams";
import {
  getExamStatus,
  EXAM_STATUS_LABEL,
  type ExamStatus,
} from "../utils/examStatus";
import type { ExamCardData } from "./ops/ExamKanbanCard";
import { Button } from "@/shared/ui/ds";
import KPICard from "./ops/KPICard";
import ExamKanbanCard from "./ops/ExamKanbanCard";

const STATUS_ORDER: ExamStatus[] = ["draft", "open", "grading", "completed"];

type Props = {
  lectureId: number;
  sessionId: number;
  /** 메인 영역에서 시험 추가 모달 열기 (좌측 패널과 동일 모달) */
  onAddExam?: () => void;
};

function toCard(row: SessionExamRow): ExamCardData {
  const status = getExamStatus(row.open_at, row.close_at);
  return {
    id: row.exam_id,
    title: row.title ?? "",
    status,
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
    const s = { draft: 0, open: 0, grading: 0, completed: 0 };
    cards.forEach((c) => {
      if (c.status in s) s[c.status as keyof typeof s]++;
    });
    return s;
  }, [cards]);

  const byStatus = useMemo(() => {
    const map: Record<ExamStatus, ExamCardData[]> = {
      draft: [],
      open: [],
      grading: [],
      completed: [],
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

  const hasGrading = stats.grading > 0;
  const hasNoExams = !isLoading && byStatus.draft.length + byStatus.open.length + byStatus.grading.length + byStatus.completed.length === 0;

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
            시험 추가 모달에서 템플릿을 선택하거나 새로 만든 뒤, 제목·공개 기간을 입력해 완성하세요.
          </p>
          <Button type="button" intent="primary" size="lg" onClick={onAddExam}>
            + 시험 추가
          </Button>
        </div>
      )}
      {!hasNoExams && hasGrading && (
        <p className="mt-1 flex items-center gap-1.5 rounded border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-200">
          <span className="font-medium">채점이 필요한 시험이 있습니다</span>
        </p>
      )}

      {!hasNoExams && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <KPICard label="초안" value={stats.draft} color="gray" />
            <KPICard label="진행중" value={stats.open} color="blue" />
            <KPICard label="채점대기" value={stats.grading} color="yellow" />
            <KPICard label="완료" value={stats.completed} color="green" />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            {STATUS_ORDER.map((status) => (
              <div
                key={status}
                className={`rounded-lg border border-[var(--color-border-divider)] bg-[var(--color-bg-surface-soft)] p-3 ${
                  status === "grading"
                    ? "border-amber-500/30 bg-amber-500/5"
                    : ""
                }`}
              >
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
                  {EXAM_STATUS_LABEL[status]}
                </div>
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
                        isUrgent={status === "grading"}
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
