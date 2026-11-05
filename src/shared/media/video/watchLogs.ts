import api from "@/shared/api/axios";

export interface WatchStudent {
  student_id: number;
  student_name: string;
  used_ms: number;
  started_at: string;
}

export interface WatchReport {
  enabled: boolean;
  updated_at?: string;
  source_type?: string;
  duration: number | null;
  threshold_ms: number;
  students: WatchStudent[];
}

export const watchReportKey = (videoId: number) => ["video-review-watch", videoId] as const;
export const fetchWatchReport = async (videoId: number, signal?: AbortSignal) =>
  (await api.get<WatchReport>(`/media/videos/${videoId}/review-watch/report/`, { signal })).data;

export function watchDuration(ms: number) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  return minutes >= 60
    ? `${Math.floor(minutes / 60)}시간 ${minutes % 60}분 ${seconds % 60}초`
    : `${minutes}분 ${seconds % 60}초`;
}

export function watchLogsPath(videoId: number, returnTo: string, base = "/workspace/videos") {
  return `${base}/${videoId}/logs?returnTo=${encodeURIComponent(returnTo)}`;
}

export function watchLogsReturnPath(value: string | null, videoId: number, teacher = false) {
  if (teacher) return value && /^\/workspace\/mobile\/videos\/\d+$/.test(value) ? value : `/workspace/mobile/videos/${videoId}`;
  // Only an existing video screen can become the return destination.
  return value && /^\/workspace\/(?:videos(?:\/tree)?(?:\?[^#]*)?|lectures\/\d+\/sessions\/\d+\/videos(?:\/\d+)?(?:\?[^#]*)?)$/.test(value)
    ? value : "/workspace/videos";
}
