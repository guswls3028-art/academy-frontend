// src/features/videos/api/videos.ts
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

  // backend 원본 필드(상대경로) - 유지
  thumbnail?: string | null;
  hls_path: string | null;

  // ✅ backend 패치로 추가된 CDN 절대 URL
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

  progress: number; // 0 ~ 1 (백엔드 기준)
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

/**
 * upload/init 응답
 */
export interface UploadInitResponse {
  video: Video;
  upload_url: string;
  file_key: string;
  content_type: string;
}

/* ===========================
   ✅ Policy Impact (NEW)
   =========================== */

export type PolicyImpactRule = "free" | "once" | "blocked";

export interface PolicyImpactRow {
  enrollment: number;
  student_name: string;
  effective_rule: PolicyImpactRule;
}

export interface PolicyImpactResponse {
  eligible_count: number;   // 정책 적용 대상(대개 blocked 제외)
  impacted_count: number;   // 이번 변경으로 실제 영향 받는 대상 수
  changed_fields: {
    allow_skip: { before: boolean; after: boolean };
    max_speed: { before: number; after: number };
    show_watermark: { before: boolean; after: boolean };
  };
  breakdown_by_rule: Record<PolicyImpactRule, number>;
  sample: PolicyImpactRow[]; // 상단 샘플(예: 20명)
}

/* ===========================
   MEDIA API
   =========================== */

export async function fetchSessionVideos(sessionId: number): Promise<Video[]> {
  const res = await api.get("/media/videos/", {
    params: { session: sessionId },
  });

  // DRF pagination 대응
  return res.data?.results ?? res.data;
}

export async function fetchVideoDetail(videoId: number): Promise<VideoDetail> {
  const res = await api.get(`/media/videos/${videoId}/`);
  return res.data;
}

export async function fetchVideoStats(videoId: number): Promise<VideoStats> {
  const res = await api.get(`/media/videos/${videoId}/stats/`);
  return res.data;
}

export async function retryVideo(videoId: number): Promise<void> {
  await api.post(`/media/videos/${videoId}/retry/`);
}

/**
 * ✅ NEW: policy-impact (저장 전 미리보기)
 * GET /media/videos/:id/policy-impact/?allow_skip=...&max_speed=...&show_watermark=...
 */
export async function fetchPolicyImpact(params: {
  videoId: number;
  allow_skip: boolean;
  max_speed: number;
  show_watermark: boolean;
}): Promise<PolicyImpactResponse> {
  const res = await api.get(`/media/videos/${params.videoId}/policy-impact/`, {
    params: {
      allow_skip: params.allow_skip,
      max_speed: params.max_speed,
      show_watermark: params.show_watermark,
    },
  });
  return res.data;
}

/**
 * Step 1) upload/init
 */
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

/**
 * Step 2) upload/complete
 */
export async function uploadComplete(videoId: number): Promise<void> {
  await api.post(`/media/videos/${videoId}/upload/complete/`);
}

/* ===========================
   🚫 LEGACY (완전 제거됨)
   =========================== */
// createVideoUrl ❌
// external_url ❌
// youtube_id ❌
