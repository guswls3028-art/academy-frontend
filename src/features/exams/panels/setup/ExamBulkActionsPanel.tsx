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
      qc.invalidateQueries({ queryKey: ["exam", examId] });
      qc.invalidateQueries({ queryKey: ["exam-results"] });
      qc.invalidateQueries({ queryKey: ["exam-submissions"] });
    },
    onError: (error: unknown) => {
      feedback.error((error as Error)?.message ?? "재채점에 실패했습니다.");
    },
  });

  return (
    <section className="rounded border border-[var(--border-divider)] bg-[var(--bg-surface)]">
      <div className="border-b border-[var(--border-divider)] px-4 py-3">
        <div className="text-sm font-semibold text-[var(--text-primary)]">OMR 업로드</div>
        <div className="mt-0.5 text-xs text-[var(--text-muted)]">
          재채점 실행 및 OMR 파일 업로드
        </div>
      </div>

      <div className="space-y-4 p-4">
        <Button
          type="button"
          intent="danger"
          size="md"
          onClick={() => recalc.mutate()}
          disabled={recalc.isPending}
          loading={recalc.isPending}
        >
          {recalc.isPending ? "재채점 중..." : "재채점 실행"}
        </Button>

        <AdminOmrBatchUploadBox examId={examId} />
      </div>
    </section>
  );
}
