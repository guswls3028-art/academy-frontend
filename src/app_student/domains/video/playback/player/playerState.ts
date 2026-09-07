import type { AccessMode } from "@/shared/api/contracts/videos";
import type { ControllerState } from "./headless/StudentHlsController";

export type Policy = {
  access_mode?: AccessMode;
  monitoring_enabled?: boolean;
  allow_seek?: boolean;
  seek?: {
    mode?: string;
    grace_seconds?: number;
    enabled?: boolean;
    step_seconds?: number;
    limit_seconds?: number;
    used_seconds?: number;
    remaining_seconds?: number;
    unavailable_reason?: "" | "duration_unavailable" | "limit_reached";
  };
  playback_rate?: { max?: number; ui_control?: boolean };
  watermark?: { enabled?: boolean };
  source?: { type?: string; provider?: string; youtube_video_id?: string | null };
};

export function normalizePolicy(value: Partial<Policy> | null | undefined): Policy {
  const policy: Policy = { ...(value || {}) };
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

export const initialControllerState: ControllerState = {
  ready: false,
  playing: false,
  buffering: false,
  duration: 0,
  current: 0,
  volume: 1,
  muted: false,
  rate: 1,
  toast: null,
  qualities: [],
  currentQuality: -1,
  reconnecting: false,
};
