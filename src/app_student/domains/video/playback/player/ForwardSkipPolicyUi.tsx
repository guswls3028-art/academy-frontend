import { formatClock } from "./design/utils";
import type { ForwardSkipBudgetState } from "./forwardSkipPolicy";

export function ForwardSkipBudgetStatus({
  pending,
  budget,
}: {
  pending: boolean;
  budget: ForwardSkipBudgetState;
}) {
  const value = pending
    ? "승인 중…"
    : budget.unavailable_reason === "duration_unavailable"
      ? "영상 길이 확인 필요"
      : budget.remaining_seconds > 0
        ? `10초씩 · ${formatClock(budget.remaining_seconds)} 남음`
        : "사용 가능한 시간을 모두 썼어요";

  return (
    <div className="svpSkipBudget" role="status" aria-live="polite">
      <div className="svpSkipBudgetCopy">
        <span className="svpSkipBudgetLabel">쉬는 시간 건너뛰기</span>
        <span className="svpSkipBudgetValue">{value}</span>
      </div>
      <progress
        className="svpSkipBudgetTrack"
        max={Math.max(1, budget.limit_seconds)}
        value={budget.remaining_seconds}
        aria-hidden="true"
      />
    </div>
  );
}

export function PlaybackPolicyHints({
  allowSeek,
  seekMode,
  boundedForward,
  budgetedForward,
  speedLocked,
}: {
  allowSeek: boolean;
  seekMode: string;
  boundedForward: boolean;
  budgetedForward: boolean;
  speedLocked: boolean;
}) {
  if (allowSeek && !speedLocked && !budgetedForward) return null;

  return (
    <div className="svpPolicyHint">
      {(!allowSeek || seekMode === "blocked") && (
        <span className="svpPolicyHintItem">
          • 탐색이 제한됩니다{boundedForward ? " (시청한 구간만 이동 가능)" : ""}
        </span>
      )}
      {allowSeek && seekMode !== "blocked" && boundedForward && (
        <span className="svpPolicyHintItem">• 앞으로 탐색이 제한됩니다</span>
      )}
      {budgetedForward && (
        <span className="svpPolicyHintItem">
          • 앞으로는 10초씩, 영상별 허용 시간 안에서 이동할 수 있습니다
        </span>
      )}
      {speedLocked && <span className="svpPolicyHintItem">• 배속 변경이 제한됩니다</span>}
    </div>
  );
}
