import { reviewWatchTime, type ReviewWatchSummary } from "./reviewWatchSummary";
import "./ReviewWatchSummaryPanel.css";

export default function ReviewWatchSummaryPanel({ summary, compact = false, remainingMs }: {
  summary: ReviewWatchSummary | null | undefined;
  compact?: boolean;
  remainingMs?: number | null;
}) {
  if (!summary) return null;
  const limited = summary.enabled && summary.applicable && summary.limit_ms !== null;
  const remaining = remainingMs === undefined ? summary.remaining_ms : remainingMs;
  return <section className={`review-usage${compact ? " review-usage--compact" : ""}${summary.exhausted ? " review-usage--exhausted" : ""}`} aria-label="복습 시청시간">
    <div className="review-usage__heading"><strong>{summary.applicable ? "복습 시청시간" : "수업 시청"}</strong>
      <span>{!summary.applicable ? "복습시간 차감 없음" : !summary.enabled ? "시간 제한 없음" : summary.exhausted ? "남은 시간 없음" : remaining === null ? "한도 확인 필요" : `${reviewWatchTime(remaining, true)} 남음`}</span>
    </div>
    {summary.applicable && <>
      {limited && <progress aria-label="복습 시청시간 사용량" max={Math.max(1, summary.limit_ms!)} value={Math.min(summary.used_ms, Math.max(1, summary.limit_ms!))} />}
      <p className="review-usage__numbers">사용 {reviewWatchTime(summary.used_ms)}{limited ? ` / 허용 ${reviewWatchTime(summary.limit_ms!)}` : ""}</p>
      {!compact && <p className="review-usage__help">되감아 다시 본 시간도 포함됩니다. 진도율과는 별도로 집계합니다.{summary.exhausted ? " 선생님이 시간을 추가하면 다시 시청할 수 있습니다." : ""}</p>}
    </>}
  </section>;
}
