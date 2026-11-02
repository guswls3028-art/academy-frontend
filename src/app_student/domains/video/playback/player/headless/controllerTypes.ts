/** Shared HLS/YouTube controller contracts; no player runtime dependency. */
export type EventType =
  | "VISIBILITY_HIDDEN"
  | "VISIBILITY_VISIBLE"
  | "FOCUS_LOST"
  | "FOCUS_GAINED"
  | "SEEK_ATTEMPT"
  | "SPEED_CHANGE_ATTEMPT"
  | "FULLSCREEN_ENTER"
  | "FULLSCREEN_EXIT"
  | "PLAYER_ERROR";

export interface Policy {
  access_mode?: string;
  monitoring_enabled?: boolean;
  allow_seek?: boolean;
  seek?: {
    mode?: string;
    grace_seconds?: number;
    step_seconds?: number;
    limit_seconds?: number;
    used_seconds?: number;
    remaining_seconds?: number;
    unavailable_reason?: string;
  };
  playback_rate?: { max?: number; ui_control?: boolean };
  watermark?: { enabled?: boolean };
}

export function normalizeControllerPolicy(p: Partial<Policy> | null | undefined): Policy {
  const policy: Policy = { ...(p || {}) };
  const seek = { ...(policy.seek || {}) };
  const playbackRate = { ...(policy.playback_rate || {}) };
  const watermark = { ...(policy.watermark || {}) };
  if (policy.monitoring_enabled == null) {
    policy.monitoring_enabled = policy.access_mode === "PROCTORED_CLASS";
  }
  if (policy.allow_seek == null) policy.allow_seek = true;
  if (!seek.mode) seek.mode = "free";
  if (seek.grace_seconds == null) seek.grace_seconds = 3;
  if (playbackRate.max == null) playbackRate.max = 16;
  if (playbackRate.ui_control == null) playbackRate.ui_control = true;
  if (watermark.enabled == null) watermark.enabled = false;
  policy.seek = seek;
  policy.playback_rate = playbackRate;
  policy.watermark = watermark;
  return policy;
}

export interface QualityLevel {
  /** hls.js levels[] 인덱스. -1 = Auto(ABR). */
  index: number;
  /** 표시용 라벨 (예: "1080p", "Auto") */
  label: string;
  /** 세로 해상도 (px). Auto는 0. */
  height: number;
  /** 비트레이트 (bps) — 라벨 보조 정보 */
  bitrate: number;
}

export interface ControllerState {
  ready: boolean;
  playing: boolean;
  buffering: boolean;
  duration: number;
  current: number;
  volume: number;
  muted: boolean;
  rate: number;
  toast: { text: string; kind?: "info" | "warn" | "danger" } | null;
  /** HLS 화질 목록 — 첫 항목은 항상 "Auto"(index=-1) */
  qualities: QualityLevel[];
  /** 현재 선택된 level 인덱스. -1 = Auto */
  currentQuality: number;
  /** 자동 재시도 진행 상태 — UI에서 "재연결 중…" 표시용 */
  reconnecting: boolean;
}

export interface ControllerOptions {
  reviewStream?: string;
  eventProtocolVersion?: 1 | 2;
  sessionId?: string | null;
  expiresAt?: number | null;
  videoId: number;
  playUrl: string;
  policy: Partial<Policy> | null | undefined;
  token: string;
  enrollmentId: number | null;
  initialPosition?: number;
  initialProgress?: number;
  onFatal?: (reason: string) => void;
  onEnded?: () => void;
  onLeaveProgress?: (data: { progress?: number; last_position?: number; completed?: boolean }) => void;
}
