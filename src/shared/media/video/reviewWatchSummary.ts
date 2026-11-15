/** Server-owned allowance; progress and monitored class time are separate. */
export interface ReviewWatchSummary {
  enabled: boolean;
  applicable: boolean;
  used_ms: number;
  limit_ms: number | null;
  remaining_ms: number | null;
  exhausted: boolean;
  revision: string;
}

export function reviewWatchTime(ms: number, roundUp = false): string {
  const seconds = Math.max(0, roundUp ? Math.ceil(ms / 1000) : Math.floor(ms / 1000));
  const minutes = Math.floor(seconds / 60);
  return minutes >= 60
    ? `${Math.floor(minutes / 60)}시간 ${minutes % 60}분 ${seconds % 60}초`
    : `${minutes}분 ${seconds % 60}초`;
}
