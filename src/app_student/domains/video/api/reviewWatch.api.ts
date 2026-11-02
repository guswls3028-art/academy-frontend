import api from "@student/shared/api/student.api";

export type ReviewWatch = { stream: string; used_ms: number; remaining_ms: number | null };

export async function prepareReviewPlayback(videoId: number, enrollmentId: number | null, stream: string) {
  const { data } = await api.post<ReviewWatch & { retry_after_ms?: number }>(`/student/video/videos/${videoId}/review-watch/`, {
    stream, sequence: 1, prepare: true, ...(enrollmentId ? { enrollment: enrollmentId } : {}),
  });
  if (data.stream !== stream || data.remaining_ms === 0) throw new Error("복습 시청시간을 모두 사용했습니다.");
  return data.retry_after_ms ?? 0;
}

export async function reportReviewWatch(
  videoId: number, enrollmentId: number | null, stream: string, sequence: number, playing: boolean,
) {
  const result = await api.post<ReviewWatch>(`/student/video/videos/${videoId}/review-watch/`, {
    stream, sequence, playing, ...(enrollmentId ? { enrollment: enrollmentId } : {}),
  });
  if (result.data?.stream !== stream || !Number.isFinite(result.data.used_ms)
      || !(result.data.remaining_ms === null || Number.isFinite(result.data.remaining_ms))) {
    throw new Error("복습 시청시간을 확인할 수 없습니다.");
  }
  return result.data;
}
