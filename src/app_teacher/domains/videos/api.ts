// PATH: src/app_teacher/domains/videos/api.ts
// 영상 API — 기존 admin videos API 재사용
import api from "@/shared/api/axios";

/** 전체 영상 목록 (최근순, 강의 기반) */
export async function fetchVideos(params?: { session?: number; lecture?: number }) {
  const res = await api.get("/media/videos/", {
    params: { ...params, page_size: 100, ordering: "-created_at" },
  });
  const raw = res.data;
  return Array.isArray(raw?.results) ? raw.results : Array.isArray(raw) ? raw : [];
}

/** 영상 상세 */
export async function fetchVideoDetail(videoId: number) {
  const res = await api.get(`/media/videos/${videoId}/`);
  return res.data;
}

/** 영상 시청 통계 */
export async function fetchVideoStats(videoId: number) {
  const res = await api.get(`/media/videos/${videoId}/stats/`);
  return res.data;
}

/** 실패한 영상 재시도 */
export async function retryVideo(videoId: number) {
  await api.post(`/media/videos/${videoId}/retry/`);
}
