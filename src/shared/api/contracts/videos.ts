import api from "@/shared/api/axios";
import { getApiErrorMessage } from "@/shared/api/errorMessage";

export type VideoStatus =
  | "PENDING"
  | "UPLOADED"
  | "PROCESSING"
  | "READY"
  | "FAILED";

export type AccessMode = "FREE_REVIEW" | "PROCTORED_CLASS" | "BLOCKED";
export type VideoRule = "free" | "once" | "blocked";
export type VideoSourceType = "s3" | "unknown";

export interface Video {
  id: number;
  session_id: number;
  folder?: number | null;
  title: string;
  file_key: string;
  file_size?: number | null;
  duration: number | null;
  order: number;
  status: VideoStatus;
  error_reason?: string | null;
  encoding_progress?: number | null;
  encoding_remaining_seconds?: number | null;
  encoding_step_index?: number | null;
  encoding_step_total?: number | null;
  encoding_step_name?: string | null;
  encoding_step_percent?: number | null;
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
  view_count?: number | null;
}

export interface VideoDetail extends Video {
  can_retry?: boolean;
}

export const VIDEO_STATUS_IN_PROGRESS: VideoStatus[] = [
  "PENDING",
  "UPLOADED",
  "PROCESSING",
];

export const VIDEO_STATUS_RETRY_ALLOWED: VideoStatus[] = [
  "PENDING",
  "FAILED",
  "PROCESSING",
  "UPLOADED",
];

export const VIDEO_STATUS_LABEL: Record<VideoStatus, string> = {
  PENDING: "업로드 대기",
  UPLOADED: "인코딩 대기",
  PROCESSING: "인코딩 중",
  READY: "시청 가능",
  FAILED: "처리 실패",
};

export const VIDEO_STATUS_TONE: Record<VideoStatus, "success" | "danger" | "warning" | "primary" | "neutral"> = {
  PENDING: "neutral",
  UPLOADED: "primary",
  PROCESSING: "warning",
  READY: "success",
  FAILED: "danger",
};

export function mapRuleToAccessMode(rule: VideoRule): AccessMode {
  const mapping: Record<VideoRule, AccessMode> = {
    free: "FREE_REVIEW",
    once: "PROCTORED_CLASS",
    blocked: "BLOCKED",
  };
  return mapping[rule] || "FREE_REVIEW";
}

export function mapAccessModeToRule(accessMode: AccessMode): VideoRule {
  const mapping: Record<AccessMode, VideoRule> = {
    FREE_REVIEW: "free",
    PROCTORED_CLASS: "once",
    BLOCKED: "blocked",
  };
  return mapping[accessMode] || "free";
}

type VideoPayload = Partial<Video> & {
  thumbnail?: string | null;
};

export function normalizeVideo(v: unknown): Video {
  if (!v || typeof v !== "object") return v as Video;

  const payload = v as VideoPayload;
  if (!payload.thumbnail_url && payload.thumbnail) {
    return { ...payload, thumbnail_url: payload.thumbnail } as Video;
  }
  return payload as Video;
}

export function isVideoInProgress(status: string | undefined): boolean {
  return status != null && VIDEO_STATUS_IN_PROGRESS.includes(status as VideoStatus);
}

export function isRetryAllowedByStatus(status: string | undefined): boolean {
  return status != null && VIDEO_STATUS_RETRY_ALLOWED.includes(status as VideoStatus);
}

export function canShowRetryButton(video: {
  status?: string | null;
  file_key?: string | null;
  can_retry?: boolean;
}): boolean {
  if (typeof video.can_retry === "boolean") {
    return video.can_retry;
  }
  if (!video.status || !VIDEO_STATUS_RETRY_ALLOWED.includes(video.status as VideoStatus)) {
    return false;
  }
  if (video.status === "PENDING") {
    return !!(video.file_key && video.file_key.trim());
  }
  return true;
}

export function getRetryErrorMessage(e: unknown): string {
  const raw = getApiErrorMessage(e, "재시도 요청에 실패했습니다.");
  return mapRetryErrorForUser(raw);
}

function mapRetryErrorForUser(backendMessage: string): string {
  const s = backendMessage.trim().toLowerCase();
  if (s.includes("already in backlog") || s.includes("job queued") || s.includes("retry wait")) {
    return "이미 처리 중이거나 대기 중입니다. 잠시 후 다시 시도해 주세요.";
  }
  if (s.includes("대기열이 가득") || s.includes("처리 중인 영상이 많아")) {
    return "처리 대기열이 가득 찼습니다. 잠시 후 자동으로 처리됩니다.";
  }
  if (s.includes("currently running") || s.includes("job is currently")) {
    return "현재 처리 중인 작업이 있습니다. 완료 후 다시 시도해 주세요.";
  }
  if (s.includes("cannot retry") || s.includes("status must be")) {
    return "현재 상태에서는 재시도할 수 없습니다.";
  }
  if (s.includes("업로드된 파일 정보가 없습니다") || s.includes("파일 정보가 없습니다")) {
    return "업로드된 파일을 찾을 수 없습니다. 삭제 후 다시 업로드해 주세요.";
  }
  if (s.includes("업로드가 완료되지 않았습니다") || s.includes("파일을 먼저 업로드")) {
    return "업로드가 완료되지 않았습니다. 파일을 먼저 업로드해 주세요.";
  }
  if (s.includes("s3 object not found") || s.includes("source_not_found")) {
    return "업로드된 파일을 찾을 수 없습니다. 삭제 후 다시 업로드해 주세요.";
  }
  if (s.includes("not found") || s.includes("찾을 수 없습니다")) {
    return "영상을 찾을 수 없습니다.";
  }
  return backendMessage;
}

export async function fetchInProgressVideos(): Promise<Video[]> {
  const all: Video[] = [];
  for (const status of VIDEO_STATUS_IN_PROGRESS) {
    try {
      const res = await api.get("/media/videos/", { params: { status } });
      const d = res?.data;
      const list = Array.isArray(d) ? d : d?.results ?? [];
      all.push(...list.map(normalizeVideo));
    } catch {
      // 개별 상태 요청 실패는 무시하고 나머지 작업 상태 복원은 유지한다.
    }
  }
  return all;
}

export async function fetchVideoDetail(videoId: number): Promise<VideoDetail> {
  const res = await api.get(`/media/videos/${videoId}/`);
  const data = res.data;
  if (!data || !data.id) {
    throw new Error(`Video ${videoId} not found`);
  }
  return normalizeVideo(data);
}

export async function retryVideo(videoId: number): Promise<void> {
  await api.post(`/media/videos/${videoId}/retry/`);
}
