import EmptyState from "../../../layout/EmptyState";
import { IconChevronRight } from "@student/shared/ui/icons/Icons";
import { isReviewLimitExhausted } from "../api/reviewWatch.api";

export default function VideoPlaybackError({ message, error, onRetry, onBack }: {
  message: string | null;
  error: unknown;
  onRetry: () => void;
  onBack: () => void;
}) {
  const exhausted = isReviewLimitExhausted(message, error);
  return (
    <div className="vpp-error">
      <EmptyState title={exhausted ? "복습 시청시간을 모두 사용했어요" : "재생을 시작할 수 없어요"}
        description={message || "잠시 후 다시 시도해 주세요."} onRetry={exhausted ? undefined : onRetry} />
      <button type="button" className="vpp-back-btn" onClick={onBack} aria-label="뒤로가기">
        <IconChevronRight className="vpp-icon-back" aria-hidden="true" />
        <span>뒤로가기</span>
      </button>
    </div>
  );
}
