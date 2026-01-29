// PATH: src/features/homework/components/common/HomeworkHeader.tsx
/**
 * HomeworkHeader
 * - exams/common/ExamHeader UX 복제
 * - 과제 점수/판정은 "세션 > 성적"에서 처리(고정 안내)
 */

import type { HomeworkSummary } from "../../types";

export default function HomeworkHeader({
  homework,
}: {
  homework: HomeworkSummary;
}) {
  const statusLabel =
    homework.status === "OPEN"
      ? "OPEN"
      : homework.status === "CLOSED"
      ? "CLOSED"
      : "DRAFT";

  return (
    <div className="mb-6 space-y-2">
      <h2 className="text-lg font-semibold text-[var(--text-primary)]">
        {homework.title}
      </h2>

      <div className="text-sm text-[var(--text-secondary)]">
        상태: <span className="font-medium">{statusLabel}</span>
      </div>

      <div className="text-xs text-[var(--text-muted)]">
        ※ 과제의 <b>성적 입력 · 판정</b>은 <b>세션 &gt; 성적</b> 메뉴에서
        진행합니다.
      </div>
    </div>
  );
}
