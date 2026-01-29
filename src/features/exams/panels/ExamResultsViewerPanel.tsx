import ExamResultsPanel
  from "@/features/results/panels/ExamResultsPanel";

export default function ExamResultsViewerPanel({
  examId,
}: {
  examId: number;
}) {
  return (
    <div className="space-y-3">
      <div>
        <div className="font-semibold text-sm">
          시험 결과
        </div>
        <div className="text-xs text-muted">
          학생별 결과 및 통계
        </div>
      </div>

      <ExamResultsPanel examId={examId} />
    </div>
  );
}
