// PATH: src/features/videos/api/videos.ts

import api from "@/shared/api/axios";

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

export interface VideoStatsStudent {
  enrollment: number;
  student_name: string;

  progress: number;
  completed: boolean;

  attendance_status: string | null;
  effective_rule: "free" | "once" | "blocked";

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

export type PolicyImpactRule = "free" | "once" | "blocked";

export interface PolicyImpactRow {
  enrollment: number;
  student_name: string;
  effective_rule: PolicyImpactRule;
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

export async function fetchSessionVideos(
  sessionId: number
): Promise<Video[]> {
  const res = await api.get("/media/videos/", {
    params: { session: sessionId },
  });

  const d = res?.data;
  if (Array.isArray(d)) return d;
  if (Array.isArray(d?.results)) return d.results;
  return [];
}

export async function fetchVideoDetail(
  videoId: number
): Promise<VideoDetail> {
  const res = await api.get(`/media/videos/${videoId}/`);
  return safeData<VideoDetail>(res.data, {} as any);
}

export async function fetchVideoStats(
  videoId: number
): Promise<VideoStats> {
  const res = await api.get(`/media/videos/${videoId}/stats/`);
  return safeData<VideoStats>(res.data, {
    video: {} as any,
    students: [],
  });
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
  return res.data;
}

export async function uploadComplete(
  videoId: number
): Promise<void> {
  await api.post(`/media/videos/${videoId}/upload/complete/`);
}
