// PATH: src/features/exams/panels/setup/ExamBulkActionsPanel.tsx

import { useMutation } from "@tanstack/react-query";
import { recalculateExam } from "../../api/adminExam";
import AdminOmrBatchUploadBox from "@/features/submissions/components/AdminOmrBatchUploadBox";
import { Button } from "@/shared/ui/ds";

export default function ExamBulkActionsPanel({ examId }: { examId: number }) {
  const recalc = useMutation({
    mutationFn: () => recalculateExam(examId),
  });

  return (
    <section className="space-y-6 rounded border border-[var(--border-divider)] bg-[var(--bg-surface)] p-5">
      <div>
        <div className="text-lg font-semibold">OMR 업로드</div>
        <div className="text-xs text-muted">
          재채점 실행 및 OMR 파일 업로드
        </div>
      </div>

      <div className="space-y-4">
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
