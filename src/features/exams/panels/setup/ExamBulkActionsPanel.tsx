// PATH: src/features/exams/panels/setup/ExamBulkActionsPanel.tsx

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { recalculateExam } from "../../api/adminExam";
import AdminOmrBatchUploadBox from "@/features/submissions/components/AdminOmrBatchUploadBox";
import { Button } from "@/shared/ui/ds";
import { feedback } from "@/shared/ui/feedback/feedback";

export default function ExamBulkActionsPanel({ examId }: { examId: number }) {
  const qc = useQueryClient();
  const recalc = useMutation({
    mutationFn: () => recalculateExam(examId),
    onSuccess: () => {
      feedback.success("재채점이 완료되었습니다.");
      qc.invalidateQueries({ queryKey: ["admin-exam", examId] });
      qc.invalidateQueries({ queryKey: ["admin-exam-results", examId] });
      qc.invalidateQueries({ queryKey: ["admin-submissions"] });
      qc.invalidateQueries({ queryKey: ["admin-pending-submissions"] });
    },
    onError: (error: unknown) => {
      feedback.error((error as Error)?.message ?? "재채점에 실패했습니다.");
    },
  });

  return (
    <section className="rounded-lg border border-[var(--color-border-divider)] bg-[var(--color-bg-surface)] overflow-hidden">
      <div className="flex items-center justify-between border-b border-[var(--color-border-divider)] px-4 py-3">
        <div>
          <div className="text-sm font-semibold text-[var(--color-text-primary)]">OMR 업로드 · 재채점</div>
          <div className="mt-0.5 text-xs text-[var(--color-text-muted)] leading-relaxed">
            학생이 작성한 OMR 답안지를 스캔하여 업로드하면 객관식이 자동 채점됩니다. 답안 수정 후에는 재채점을 실행하세요.
          </div>
        </div>
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

      <div className="p-4">
        <AdminOmrBatchUploadBox examId={examId} />
      </div>
    </section>
  );
}
