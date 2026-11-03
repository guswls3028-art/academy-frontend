import api from "@student/shared/api/student.api";

export const REVIEW_EXHAUSTED = "이 영상의 복습 시청시간을 모두 사용했습니다.";

export function isReviewLimitExhausted(message: string | null, error: unknown) {
  return message === REVIEW_EXHAUSTED ||
    (error as { response?: { data?: { code?: string } } } | null)?.response?.data?.code === "review_limit_exhausted";
}

export type ReviewWatch = { stream: string; used_ms: number; remaining_ms: number | null };

export async function prepareReviewPlayback(videoId: number, enrollmentId: number | null, stream: string, position: number) {
  const { data } = await api.post<ReviewWatch & { retry_after_ms?: number }>(`/student/video/videos/${videoId}/review-watch/`, {
    stream, sequence: 1, prepare: true, position_ms: Math.max(0, Math.round(position * 1000)), ...(enrollmentId ? { enrollment: enrollmentId } : {}),
  });
  if (data.stream !== stream) throw new Error("복습 재생 권한을 다시 확인해 주세요.");
  if (data.remaining_ms === 0) throw new Error(REVIEW_EXHAUSTED);
  return data.retry_after_ms ?? 0;
}

export async function reportReviewWatch(
  videoId: number, enrollmentId: number | null, stream: string, sequence: number, playing: boolean, position: number,
) {
  const result = await api.post<ReviewWatch>(`/student/video/videos/${videoId}/review-watch/`, {
    stream, sequence, playing, position_ms: Math.max(0, Math.round(position * 1000)), ...(enrollmentId ? { enrollment: enrollmentId } : {}),
  }, { timeout: 4500 });
  if (result.data?.stream !== stream || !Number.isFinite(result.data.used_ms)
      || !(result.data.remaining_ms === null || Number.isFinite(result.data.remaining_ms))) {
    throw new Error("복습 시청시간을 확인할 수 없습니다.");
  }
  return result.data;
}
