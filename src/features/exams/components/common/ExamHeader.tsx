import type { Exam } from "../../types";

/**
 * 시험 단계 (과제와 동일). DRAFT/OPEN/CLOSED 문구 노출 없음. 진행/종료 버튼만.
 */
export default function ExamHeader({ exam }: { exam: Exam; sessionId?: number | null }) {
  const isDraft = exam.status === "DRAFT";
  const isOpen = exam.status === "OPEN";
  const isClosed = exam.status === "CLOSED";

  const statusLabel = isDraft ? "초안" : isOpen ? "진행 중" : isClosed ? "마감" : exam.status;
  const statusTone = isOpen ? "success" : "neutral";

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">{exam.title}</h2>
            <span className="ds-status-badge" data-tone={statusTone}>{statusLabel}</span>
          </div>
        </div>
      </div>

      {exam.description?.trim() && (
        <div className="text-sm text-muted whitespace-pre-wrap">
          {exam.description}
        </div>
      )}
    </div>
  );
}
