/**
 * ExamResultsPanel (UX wrapper)
 *
 * WHY:
 * - results 도메인이 단일진실: 점수/합불/통계는 여기서 계산 금지
 * - exams 탭에서 "결과가 어디서 생성되고 어디서 수정되는지"를 사람 언어로 안내
 * - 실제 표/통계는 results feature의 ExamResultsPanel을 그대로 사용
 */

import ExamResultsPanelInner from "@/features/results/panels/ExamResultsPanel";

export default function ExamResultsPanel({ examId }: { examId: number }) {
  return (
    <div className="space-y-4">
      <section className="rounded border border-[var(--border-divider)] bg-[var(--bg-surface)] p-4">
        <div className="text-sm font-semibold text-[var(--text-primary)]">
          결과 / 통계
        </div>
        <div className="mt-1 text-xs text-[var(--text-muted)]">
          점수·합불·통계는 <b>results</b> 도메인이 단일 진실이며, 이 화면은 표시만 합니다.
        </div>
      </section>

      <ExamResultsPanelInner examId={examId} />
    </div>
  );
}
