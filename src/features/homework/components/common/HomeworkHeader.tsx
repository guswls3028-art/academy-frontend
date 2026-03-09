// PATH: src/features/homework/components/common/HomeworkHeader.tsx
/**
 * HomeworkHeader
 * - DRAFT/OPEN/CLOSED 문구 노출 없음. 진행하기/마감 버튼만 표시.
 */

import type { HomeworkSummary } from "../../types";

type Props = {
  homework: HomeworkSummary;
};

export default function HomeworkHeader({ homework }: Props) {
  const isDraft = homework.status === "DRAFT";
  const isOpen = homework.status === "OPEN";
  const isClosed = homework.status === "CLOSED";

  const statusLabel = isDraft ? "초안" : isOpen ? "진행 중" : isClosed ? "마감" : homework.status;
  const statusTone = isOpen ? "success" : "neutral";

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">
            {homework.title}
          </h2>
          <span className="ds-status-badge" data-tone={statusTone}>{statusLabel}</span>
        </div>
      </div>

      <div className="text-sm text-[var(--color-text-muted)]">
        ※ 과제의 <b>성적 입력 · 판정</b>은 <b>세션 &gt; 성적</b> 메뉴에서
        진행합니다.
      </div>
    </div>
  );
}
