// PATH: src/app_admin/domains/videos/api/videos.ts

import api from "@/shared/api/axios";
import {
  normalizeVideo,
  type Video,
  type VideoDetail,
} from "@/shared/api/contracts/videos";
export {
  fetchInProgressVideos,
  fetchVideoDetail,
  getRetryErrorMessage,
  retryVideo,
  type Video,
  type VideoDetail,
  type VideoSourceType,
  type VideoStatus,
} from "@/shared/api/contracts/videos";

import type { AccessMode, VideoRule } from "../types/access-mode";

export interface VideoStatsStudent {
  enrollment: number;
  student_name: string;

  progress: number;
  completed: boolean;

  attendance_status: string | null;
  effective_rule: VideoRule; // Legacy field
  access_mode?: AccessMode; // New field

  parent_phone?: string | null;
  student_phone?: string | null;
  school?: string | null;
  grade?: string | null;
}

export interface VideoStats {
  video: VideoDetail;
  students: VideoStatsStudent[];
  total_filtered?: number;
}

export interface UploadInitResponse {
  video: Video;
  upload_url: string;
  file_key: string;
  content_type: string;
}

export interface YoutubeVideoCreatePayload {
  session: number;
  title: string;
  url: string;
  folder?: number | null;
  allow_skip?: boolean;
  max_speed?: number;
  show_watermark?: boolean;
}

export interface YoutubeVideoCreateResponse {
  video: Video;
}

export type PolicyImpactRule = VideoRule; // Legacy type

export interface PolicyImpactRow {
  enrollment: number;
  student_name: string;
  effective_rule: PolicyImpactRule; // Legacy field
  access_mode?: AccessMode; // New field
  attendance_status?: string | null;
  completed?: boolean;
}

export interface PolicyImpactResponse {
  eligible_count: number;
  impacted_count: number;
  changed_fields: {
    allow_skip: { before: boolean; after: boolean };
    max_speed: { before: number; after: number };
    show_watermark: { before: boolean; after: boolean };
  };
  breakdown_by_rule: Record<PolicyImpactRule, number>;
  sample: PolicyImpactRow[];
}

function safeData<T>(d: unknown, fallback: T): T {
  if (d == null) return fallback;
  return d as T;
}

export async function fetchSessionVideos(
  sessionId: number
): Promise<Video[]> {
  const res = await api.get("/media/videos/", {
    params: { session: sessionId },
  });

  const d = res?.data;
  if (Array.isArray(d)) return d.map(normalizeVideo);
  if (Array.isArray(d?.results)) return d.results.map(normalizeVideo);
  return [];
}

/** 공개 영상 전용 세션 조회/생성 — 업로드·목록에 사용 (테넌트당 1개). 테넌트 미확인 시 null 반환(전역 에러 없음). */
export async function fetchPublicSession(): Promise<{
  session_id: number;
  lecture_id: number;
} | null> {
  try {
    const res = await api.get<{ session_id: number; lecture_id: number }>(
      "/media/videos/public-session/"
    );
    return res.data;
  } catch (e: unknown) {
    const status = (e as { response?: { status?: number } })?.response?.status;
    if (status === 400 || status === 403) {
      return null;
    }
    throw e;
  }
}

export async function fetchVideoStats(
  videoId: number
): Promise<VideoStats> {
  const res = await api.get(`/media/videos/${videoId}/stats/`);
  const data = safeData<VideoStats>(res.data, {
    video: {} as VideoDetail,
    students: [],
  });

  if (data.video) {
    data.video = normalizeVideo(data.video);
  }

  return data;
}

export async function fetchPolicyImpact(params: {
  videoId: number;
  allow_skip: boolean;
  max_speed: number;
  show_watermark: boolean;
}): Promise<PolicyImpactResponse> {
  const res = await api.get(
    `/media/videos/${params.videoId}/policy-impact/`,
    {
      params: {
        allow_skip: params.allow_skip,
        max_speed: params.max_speed,
        show_watermark: params.show_watermark,
      },
    }
  );
  return safeData<PolicyImpactResponse>(res.data, {
    eligible_count: 0,
    impacted_count: 0,
    changed_fields: {
      allow_skip: { before: false, after: false },
      max_speed: { before: 1, after: 1 },
      show_watermark: { before: false, after: false },
    },
    breakdown_by_rule: { free: 0, once: 0, blocked: 0 },
    sample: [],
  });
}

export async function uploadInit(payload: {
  session: number;
  title: string;
  filename: string;
  content_type: string;
  allow_skip?: boolean;
  max_speed?: number;
  show_watermark?: boolean;
}): Promise<UploadInitResponse> {
  const res = await api.post("/media/videos/upload/init/", payload);
  res.data.video = normalizeVideo(res.data.video);
  return res.data;
}

export async function createYoutubeVideo(
  payload: YoutubeVideoCreatePayload
): Promise<Video> {
  const res = await api.post<YoutubeVideoCreateResponse | Video>(
    "/media/videos/youtube/",
    payload
  );
  const video = "video" in res.data ? res.data.video : res.data;
  return normalizeVideo(video);
}

export async function uploadComplete(
  videoId: number
): Promise<void> {
  await api.post(`/media/videos/${videoId}/upload/complete/`);
}

// ========================================================
// Video Folders (공개 영상 폴더 구조)
// ========================================================

export type VideoFolder = {
  id: number;
  name: string;
  session_id: number;
  parent_id: number | null;
  order: number;
  created_at: string;
  updated_at: string;
};

export async function fetchVideoFolders(sessionId: number): Promise<VideoFolder[]> {
  const res = await api.get<VideoFolder[]>("/media/videos/folders/", {
    params: { session_id: sessionId },
  });
  return res.data;
}

export async function createVideoFolder(
  sessionId: number,
  name: string,
  parentId?: number | null
): Promise<VideoFolder> {
  const res = await api.post<VideoFolder>("/media/videos/folders/", {
    session_id: sessionId,
    name,
    parent_id: parentId ?? null,
  });
  return res.data;
}

export async function deleteVideoFolder(folderId: number): Promise<void> {
  await api.delete(`/media/videos/folders/${folderId}/`);
}

export async function renameVideo(videoId: number, title: string): Promise<Video> {
  const res = await api.patch(`/media/videos/${videoId}/`, { title });
  return normalizeVideo(res.data);
}

export async function updateVideo(
  videoId: number,
  data: { title?: string; order?: number; allow_skip?: boolean; max_speed?: number; show_watermark?: boolean }
): Promise<Video> {
  const res = await api.patch(`/media/videos/${videoId}/`, data);
  return normalizeVideo(res.data);
}

export async function reorderVideos(items: Array<{ id: number; order: number }>): Promise<void> {
  await api.post("/media/videos/reorder/", { items });
}

export async function deleteVideo(videoId: number): Promise<void> {
  try {
    await api.delete(`/media/videos/${videoId}/`);
  } catch (e: unknown) {
    // 404 = 이미 삭제됨 (작업박스에서 삭제 후 영상탭에서 중복 삭제 등)
    const status = (e as { response?: { status?: number } })?.response?.status;
    if (status === 404) return;
    throw e;
  }
}

// ========================================================
// Video Social (댓글 · 좋아요 · 조회수 — 관리자 전용)
// ========================================================

export type VideoCommentItem = {
  id: number;
  content: string;
  author_type: "student" | "teacher";
  author_name: string;
  author_photo_url: string | null;
  is_edited: boolean;
  is_deleted: boolean;
  is_mine: boolean;
  created_at: string;
  reply_count: number;
  replies: VideoCommentItem[];
};

export type VideoCommentsResponse = {
  comments: VideoCommentItem[];
  total: number;
};

export type VideoEngagement = {
  view_count: number;
  like_count: number;
  comment_count: number;
};

/** 관리자용 댓글 목록 조회 */
export async function fetchAdminVideoComments(
  videoId: number
): Promise<VideoCommentsResponse> {
  const res = await api.get(`/media/videos/${videoId}/comments/`);
  return safeData<VideoCommentsResponse>(res.data, { comments: [], total: 0 });
}

/** 관리자용 댓글 작성 (답글 포함) */
export async function createAdminVideoComment(
  videoId: number,
  content: string,
  parentId?: number
): Promise<VideoCommentItem> {
  const res = await api.post(`/media/videos/${videoId}/comments/`, {
    content,
    parent_id: parentId ?? null,
  });
  return res.data;
}

/** 관리자용 댓글 수정 */
export async function editAdminVideoComment(
  commentId: number,
  content: string
): Promise<{ id: number; content: string; is_edited: boolean }> {
  const res = await api.patch(`/media/videos/comments/${commentId}/`, {
    content,
  });
  return res.data;
}

/** 관리자용 댓글 삭제 */
export async function deleteAdminVideoComment(
  commentId: number
): Promise<{ deleted: boolean }> {
  const res = await api.delete(`/media/videos/comments/${commentId}/`);
  return res.data;
}

/** 관리자용 영상 engagement 통계 (조회수 · 좋아요 · 댓글 수) */
export async function fetchVideoEngagement(
  videoId: number
): Promise<VideoEngagement> {
  const res = await api.get(`/media/videos/${videoId}/engagement/`);
  return safeData<VideoEngagement>(res.data, {
    view_count: 0,
    like_count: 0,
    comment_count: 0,
  });
}
