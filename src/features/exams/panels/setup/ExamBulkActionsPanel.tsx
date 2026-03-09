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
    <div className="space-y-3">
      <div>
        <div className="text-sm font-semibold">일괄 작업</div>
        <div className="text-xs text-muted">
          재채점 실행 및 OMR / 제출 데이터 관리
        </div>
      </div>

      <div className="surface p-4 space-y-4">
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

        <div className="surface-muted p-3">
          <div className="mb-2 text-xs font-semibold text-muted">
            OMR / 제출 데이터 업로드
          </div>
          <AdminOmrBatchUploadBox examId={examId} />
        </div>
      </div>
    </div>
  );
}
