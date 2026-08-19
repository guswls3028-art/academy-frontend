export type WorkTimeline = {
  date?: string;
  started_at?: string;
  break_minutes?: number;
  break_total_seconds?: number;
  break_started_at?: string;
};

function parseStartedAt(date: string, time: string): number {
  const normalizedTime = String(time).trim().split(".")[0];
  const iso = normalizedTime.length <= 5
    ? `${date}T${normalizedTime}:00`
    : `${date}T${normalizedTime}`;
  return new Date(iso).getTime();
}

export function workElapsedSeconds(
  timeline: WorkTimeline,
  nowMs: number = Date.now(),
): number {
  if (!timeline.date || !timeline.started_at) return 0;
  const startedAt = parseStartedAt(timeline.date, timeline.started_at);
  const breakSeconds = timeline.break_total_seconds
    ?? ((timeline.break_minutes ?? 0) * 60);
  const effectiveNow = timeline.break_started_at
    ? new Date(timeline.break_started_at).getTime()
    : nowMs;
  return Math.max(0, Math.floor((effectiveNow - startedAt) / 1000) - breakSeconds);
}

export function workElapsedLabel(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
  }
  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
}
