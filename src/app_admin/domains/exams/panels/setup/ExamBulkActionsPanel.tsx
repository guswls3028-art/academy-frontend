// PATH: src/app_admin/domains/exams/panels/setup/ExamBulkActionsPanel.tsx

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { recalculateExam } from "../../api/adminExam";
import { Button } from "@/shared/ui/ds";
import { feedback } from "@/shared/ui/feedback/feedback";
import { adminExamsQueryKeys } from "../../queryKeys";

type Props = {
  examId: number;
  lectureId?: number;
  sessionId?: number;
};

export default function ExamBulkActionsPanel({ examId, lectureId, sessionId }: Props) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const canOpenScores =
    Number.isFinite(lectureId) && Number(lectureId) > 0
    && Number.isFinite(sessionId) && Number(sessionId) > 0;

  const recalc = useMutation({
    mutationFn: () => recalculateExam(examId),
    onSuccess: () => {
      feedback.success("재채점이 완료되었습니다.");
      qc.invalidateQueries({ queryKey: adminExamsQueryKeys.adminExam(examId) });
      qc.invalidateQueries({ queryKey: adminExamsQueryKeys.adminExamResults(examId) });
      qc.invalidateQueries({ queryKey: adminExamsQueryKeys.adminSubmissions });
      qc.invalidateQueries({ queryKey: adminExamsQueryKeys.adminPendingSubmissions });
    },
    onError: (error: unknown) => {
      feedback.error((error as Error)?.message ?? "재채점에 실패했습니다.");
    },
  });

  const openScores = () => {
    if (!canOpenScores) {
      feedback.info("차시 성적 화면에서 OMR을 등록할 수 있습니다.");
      return;
    }
    navigate(`/admin/lectures/${lectureId}/sessions/${sessionId}/scores`);
  };

  return (
    <section className="rounded-lg border border-[var(--color-border-divider)] bg-[var(--color-bg-surface)] overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-[var(--color-border-divider)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-sm font-semibold text-[var(--color-text-primary)]">채점 관리</div>
          <div className="mt-0.5 text-xs text-[var(--color-text-muted)] leading-relaxed">
            OMR 등록은 차시 성적 화면에서 처리합니다. 답안 수정 후에는 여기서 재채점을 실행하세요.
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" intent="secondary" size="sm" onClick={openScores}>
            성적 탭 열기
          </Button>
          <Button
            type="button"
            intent="danger"
            size="sm"
            onClick={() => recalc.mutate()}
            disabled={recalc.isPending}
            loading={recalc.isPending}
          >
            {recalc.isPending ? "재채점 중..." : "재채점 실행"}
          </Button>
        </div>
      </div>
    </section>
  );
}
