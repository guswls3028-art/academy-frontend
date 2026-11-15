import EmptyState from "../../../layout/EmptyState";
import { IconChevronRight } from "@student/shared/ui/icons/Icons";
import { isReviewLimitExhausted } from "../api/reviewWatch.api";
import ReviewWatchSummaryPanel from "@/shared/media/video/ReviewWatchSummaryPanel";
import type { ReviewWatchSummary } from "@/shared/media/video/reviewWatchSummary";

export default function VideoPlaybackError({ message, error, onRetry, onBack, summary }: {
  message: string | null;
  error: unknown;
  onRetry: () => void;
  onBack: () => void;
  summary?: ReviewWatchSummary | null;
}) {
  const exhausted = isReviewLimitExhausted(message, error);
  const confirmed = (error as { response?: { data?: { review_watch_summary?: ReviewWatchSummary } } } | null)?.response?.data?.review_watch_summary ?? summary;
  return (
    <div className="vpp-error">
      <EmptyState title={exhausted ? "복습 시청시간을 모두 사용했어요" : "재생을 시작할 수 없어요"}
        description={message || "잠시 후 다시 시도해 주세요."} onRetry={exhausted ? undefined : onRetry} />
      {exhausted && <>
        <ReviewWatchSummaryPanel summary={confirmed?.exhausted ? confirmed : undefined} />
        <p>선생님이 복습시간을 추가했다면 변경된 한도를 확인해 주세요.</p>
        <button type="button" className="vpp-back-btn" onClick={onRetry}>한도 변경 확인</button>
      </>}
      <button type="button" className="vpp-back-btn" onClick={onBack} aria-label="뒤로가기">
        <IconChevronRight className="vpp-icon-back" aria-hidden="true" />
        <span>뒤로가기</span>
      </button>
    </div>
  );
}
