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

/** 공용 세션 (영상 업로드용 기본 세션) */
export async function fetchPublicSession(): Promise<{ session_id: number; lecture_id: number } | null> {
  try {
    const res = await api.get("/media/videos/public-session/");
    return res.data;
  } catch {
    return null;
  }
}

/* ─── Video CRUD ─── */
export async function uploadInit(payload: {
  session: number;
  title: string;
  filename: string;
  content_type: string;
}) {
  const res = await api.post("/media/videos/upload-init/", payload);
  return res.data as { id: number; upload_url: string; video_key: string };
}

export async function uploadComplete(videoId: number) {
  await api.post(`/media/videos/${videoId}/upload-complete/`);
}

export async function renameVideo(videoId: number, title: string) {
  const res = await api.patch(`/media/videos/${videoId}/`, { title });
  return res.data;
}

export async function updateVideo(videoId: number, data: { title?: string; order?: number; allow_skip?: boolean; max_speed?: number; show_watermark?: boolean }) {
  const res = await api.patch(`/media/videos/${videoId}/`, data);
  return res.data;
}

export async function deleteVideo(videoId: number) {
  await api.delete(`/media/videos/${videoId}/`);
}

/* ─── Folders ─── */
export async function fetchVideoFolders(sessionId: number) {
  const res = await api.get("/media/video-folders/", { params: { session: sessionId } });
  const raw = res.data;
  return Array.isArray(raw?.results) ? raw.results : Array.isArray(raw) ? raw : [];
}

export async function createVideoFolder(sessionId: number, name: string) {
  const res = await api.post("/media/video-folders/", { session: sessionId, name });
  return res.data;
}

export async function deleteVideoFolder(folderId: number) {
  await api.delete(`/media/video-folders/${folderId}/`);
}

/* ─── Comments ─── */
export async function fetchVideoComments(videoId: number) {
  const res = await api.get(`/media/videos/${videoId}/comments/`);
  const raw = res.data;
  return Array.isArray(raw?.results) ? raw.results : Array.isArray(raw) ? raw : [];
}

export async function createVideoComment(videoId: number, content: string) {
  const res = await api.post(`/media/videos/${videoId}/comments/`, { content });
  return res.data;
}

export async function deleteVideoComment(commentId: number) {
  await api.delete(`/media/video-comments/${commentId}/`);
}
