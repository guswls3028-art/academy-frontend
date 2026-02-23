// PATH: src/features/videos/api/videos.ts

import api from "@/shared/api/axios";
import { getApiErrorMessage } from "@/shared/api/errorMessage";
import { VIDEO_STATUS_IN_PROGRESS } from "../constants/videoProcessing";

/** 재시도 API 실패 시 백엔드 메시지 추출 (400 detail/배열 포함). */
export function getRetryErrorMessage(e: unknown): string {
  const raw = getApiErrorMessage(e, "재시도 요청에 실패했습니다.");
  return mapRetryErrorForUser(raw);
}

/** 알려진 백엔드 메시지를 사용자 친화 문구로 매핑. 백엔드 메시지가 우선. */
function mapRetryErrorForUser(backendMessage: string): string {
  const s = backendMessage.trim().toLowerCase();
  if (s.includes("already in backlog") || s.includes("job queued") || s.includes("retry wait")) {
    return "이미 처리 중이거나 대기 중입니다. 잠시 후 다시 시도해 주세요.";
  }
  if (s.includes("cannot retry") || s.includes("status must be")) {
    return "현재 상태에서는 재시도할 수 없습니다.";
  }
  if (s.includes("not found") || s.includes("찾을 수 없습니다")) {
    return "영상을 찾을 수 없습니다.";
  }
  return backendMessage;
}

/**
 * Backend Video.status enum (확정)
 */
export type VideoStatus =
  | "PENDING"
  | "UPLOADED"
  | "PROCESSING"
  | "READY"
  | "FAILED";

export type VideoSourceType = "s3" | "unknown";

export interface Video {
  id: number;
  session_id: number;
  folder?: number | null; // 전체공개영상 폴더 ID
  title: string;

  file_key: string;
  duration: number | null;
  order: number;
  status: VideoStatus;

  allow_skip: boolean;
  max_speed: number;
  show_watermark: boolean;

  thumbnail?: string | null;
  hls_path: string | null;

  thumbnail_url?: string | null;
  hls_url?: string | null;

  created_at: string;
  updated_at: string;

  source_type: VideoSourceType;
}

export interface VideoDetail extends Video {}

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

function safeData<T>(d: any, fallback: T): T {
  if (d == null) return fallback;
  return d;
}

/**
 * ✅ 최소 추가
 * backend의 thumbnail → frontend thumbnail_url 매핑
 */
function normalizeVideo(v: any): Video {
  if (!v) return v;
  if (!v.thumbnail_url && v.thumbnail) {
    v.thumbnail_url = v.thumbnail;
  }
  return v as Video;
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

/** 전체공개영상 전용 세션 조회/생성 — 업로드·목록에 사용 (테넌트당 1개). 테넌트 미확인 시 null 반환(전역 에러 없음). */
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

/** 진행 중인 영상 목록 — 새로고침 후 작업 박스 복원용 (Batch 전용). */
export async function fetchInProgressVideos(): Promise<Video[]> {
  const statuses = VIDEO_STATUS_IN_PROGRESS;
  const all: Video[] = [];
  for (const s of statuses) {
    const res = await api.get("/media/videos/", { params: { status: s } });
    const d = res?.data;
    const list = Array.isArray(d) ? d : d?.results ?? [];
    all.push(...list.map(normalizeVideo));
  }
  return all;
}

export async function fetchVideoDetail(
  videoId: number
): Promise<VideoDetail> {
  const res = await api.get(`/media/videos/${videoId}/`);
  return normalizeVideo(
    safeData<VideoDetail>(res.data, {} as any)
  );
}

export async function fetchVideoStats(
  videoId: number
): Promise<VideoStats> {
  const res = await api.get(`/media/videos/${videoId}/stats/`);
  const data = safeData<VideoStats>(res.data, {
    video: {} as any,
    students: [],
  });

  if (data.video) {
    data.video = normalizeVideo(data.video);
  }

  return data;
}

export async function retryVideo(videoId: number): Promise<void> {
  await api.post(`/media/videos/${videoId}/retry/`);
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

export async function uploadComplete(
  videoId: number
): Promise<void> {
  await api.post(`/media/videos/${videoId}/upload/complete/`);
}

// ========================================================
// Video Folders (전체공개영상 폴더 구조)
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
