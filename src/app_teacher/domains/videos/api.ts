// PATH: src/app_teacher/domains/videos/api.ts
// 영상 API — 기존 admin videos API 재사용
import api from "@/shared/api/axios";
import { listFromApiResponse } from "@/shared/api/response";

export type TeacherVideo = {
  id: number;
  title: string;
  status?: string | null;
  source_type?: string | null;
  youtube_video_id?: string | null;
  youtube_url?: string | null;
  thumbnail_url?: string | null;
  duration_display?: string | null;
  created_at?: string | null;
  view_count?: number | null;
  session?: number | null;
  session_id?: number | null;
  allow_skip?: boolean | null;
  max_speed?: number | null;
  show_watermark?: boolean | null;
};

export type TeacherVideoStatsStudent = {
  id?: number | null;
  student_id?: number | null;
  name?: string | null;
  student_name?: string | null;
  profile_photo_url?: string | null;
  lecture_title?: string | null;
  lecture_color?: string | null;
  lecture_chip_label?: string | null;
  progress?: number | null;
  completed?: boolean | null;
  watched?: boolean | null;
  access_mode?: string | null;
  effective_rule?: string | null;
};

export type TeacherVideoStats = {
  students?: TeacherVideoStatsStudent[] | null;
};

export type TeacherVideoComment = {
  id: number | string;
  author_display_name?: string | null;
  author_name?: string | null;
  created_by_name?: string | null;
  created_at?: string | null;
  content?: string | null;
};

/** 전체 영상 목록 (최근순, 강의 기반) */
export async function fetchVideos(params?: { session?: number; lecture?: number }): Promise<TeacherVideo[]> {
  const res = await api.get("/media/videos/", {
    params: { ...params, page_size: 100, ordering: "-created_at" },
  });
  return listFromApiResponse<TeacherVideo>(res.data);
}

/** 영상 상세 */
export async function fetchVideoDetail(videoId: number): Promise<TeacherVideo> {
  const res = await api.get(`/media/videos/${videoId}/`);
  return res.data;
}

/** 영상 시청 통계 */
export async function fetchVideoStats(videoId: number): Promise<TeacherVideoStats> {
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
  const res = await api.post("/media/videos/upload/init/", payload);
  const data = res.data as {
    video?: { id?: number };
    id?: number;
    upload_url: string;
    file_key?: string;
    video_key?: string;
  };
  const id = data.video?.id ?? data.id;
  if (typeof id !== "number") {
    throw new Error("영상 업로드 초기화 응답에 video.id가 없습니다.");
  }
  return {
    id,
    upload_url: data.upload_url,
    video_key: data.file_key ?? data.video_key ?? "",
  };
}

export async function uploadComplete(videoId: number) {
  await api.post(`/media/videos/${videoId}/upload/complete/`);
}

export async function createYoutubeVideo(payload: {
  session: number;
  title: string;
  url: string;
  allow_skip?: boolean;
  max_speed?: number;
  show_watermark?: boolean;
}): Promise<TeacherVideo> {
  const res = await api.post<{ video?: TeacherVideo } | TeacherVideo>(
    "/media/videos/youtube/",
    payload,
  );
  const data = res.data;
  if (data && typeof data === "object" && "video" in data && data.video) {
    return data.video;
  }
  return data as TeacherVideo;
}

export async function renameVideo(videoId: number, title: string): Promise<TeacherVideo> {
  const res = await api.patch(`/media/videos/${videoId}/`, { title });
  return res.data;
}

export async function updateVideo(videoId: number, data: { title?: string; order?: number; allow_skip?: boolean; max_speed?: number; show_watermark?: boolean }): Promise<TeacherVideo> {
  const res = await api.patch(`/media/videos/${videoId}/`, data);
  return res.data;
}

export async function deleteVideo(videoId: number) {
  await api.delete(`/media/videos/${videoId}/`);
}

/* ─── Folders ─── */
export async function fetchVideoFolders(sessionId: number) {
  const res = await api.get("/media/videos/folders/", { params: { session_id: sessionId } });
  return listFromApiResponse(res.data);
}

export async function createVideoFolder(sessionId: number, name: string) {
  const res = await api.post("/media/videos/folders/", { session_id: sessionId, name });
  return res.data;
}

export async function deleteVideoFolder(folderId: number) {
  await api.delete(`/media/videos/folders/${folderId}/`);
}

/* ─── Comments ─── */
export async function fetchVideoComments(videoId: number) {
  const res = await api.get(`/media/videos/${videoId}/comments/`);
  if (Array.isArray(res.data?.comments)) return res.data.comments;
  return listFromApiResponse(res.data);
}

export async function createVideoComment(videoId: number, content: string) {
  const res = await api.post(`/media/videos/${videoId}/comments/`, { content });
  return res.data;
}

export async function deleteVideoComment(commentId: number) {
  await api.delete(`/media/videos/comments/${commentId}/`);
}
