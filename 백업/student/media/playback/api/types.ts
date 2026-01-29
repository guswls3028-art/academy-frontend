// src/student/media/playback/api/types.ts

// ============================
// Backend v1 exact types
// ============================

export type PlaybackConcurrencyPolicy = {
  max_sessions: number;
  max_devices: number;
};

export type PlaybackRatePolicy = {
  max: number;
  ui_control: boolean;
};

export type WatermarkPolicy = {
  enabled: boolean;
  mode: "overlay" | "burnin";
  fields: string[];
};

// 🔥 seek 정책 (백엔드 1:1)
export type SeekPolicy =
  | { mode: "free" }
  | { mode: "blocked" }
  | {
      mode: "bounded_forward";
      forward_limit: "max_watched";
      grace_seconds: number;
    };

export type PlaybackPolicy = {
  allow_seek: boolean; // legacy
  seek: SeekPolicy;
  playback_rate: PlaybackRatePolicy;
  watermark: WatermarkPolicy;
  concurrency: PlaybackConcurrencyPolicy;
};

// Backend enum과 정확히 일치
export type PlaybackEventType =
  | "VISIBILITY_HIDDEN"
  | "VISIBILITY_VISIBLE"
  | "FOCUS_LOST"
  | "FOCUS_GAINED"
  | "SEEK_ATTEMPT"
  | "SPEED_CHANGE_ATTEMPT"
  | "FULLSCREEN_ENTER"
  | "FULLSCREEN_EXIT"
  | "PLAYER_ERROR";

export type PlaybackEvent = {
  type: PlaybackEventType;
  occurred_at?: number;
  payload?: Record<string, any>;
};

export type PlaybackStartResponse = {
  token: string;
  session_id: string;
  expires_at: number;
  policy: PlaybackPolicy;
  play_url: string;
};

export type PostEventsBody = {
  token: string;
  events: PlaybackEvent[];
};
