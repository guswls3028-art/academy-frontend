import api from "@/shared/api/axios";
import type { PlaybackStartResponse, PostEventsBody } from "./types";

/**
 * backend 실제 존재 엔드포인트 기준
 * baseURL = http://localhost:8000/api/v1
 *
 * POST /media/playback/sessions/
 * POST /media/playback/sessions/heartbeat/
 * POST /media/playback/sessions/refresh/
 * POST /media/playback/sessions/end/
 * POST /media/playback/sessions/events/
 */

export const PLAYBACK_ENDPOINTS = {
  start: "/media/playback/sessions/",
  heartbeat: "/media/playback/sessions/heartbeat/",
  refresh: "/media/playback/sessions/refresh/",
  end: "/media/playback/sessions/end/",
  events: "/media/playback/sessions/events/",
};

// ==============================
// start playback (🔥 핵심)
// ==============================
export async function playVideo(params: {
  videoId: number;
  enrollment_id: number;
  device_id: string;
}): Promise<PlaybackStartResponse> {
  const res = await api.post(PLAYBACK_ENDPOINTS.start, {
    video_id: params.videoId,
    enrollment_id: params.enrollment_id,
    device_id: params.device_id,
  });

  return res.data as PlaybackStartResponse;
}

// ==============================
// heartbeat
// ==============================
export async function heartbeatSession(token: string) {
  await api.post(PLAYBACK_ENDPOINTS.heartbeat, { token });
}

// ==============================
// refresh
// ==============================
export async function refreshSession(
  token: string,
): Promise<PlaybackStartResponse> {
  const res = await api.post(PLAYBACK_ENDPOINTS.refresh, { token });
  return res.data as PlaybackStartResponse;
}

// ==============================
// end
// ==============================
export async function endSession(token: string) {
  await api.post(PLAYBACK_ENDPOINTS.end, { token });
}

// ==============================
// events (audit)
// ==============================
export async function postPlaybackEvents(body: PostEventsBody) {
  await api.post(PLAYBACK_ENDPOINTS.events, body);
}

// ==============================
// best-effort flush
// ==============================
export async function postPlaybackEventsBestEffort(body: PostEventsBody) {
  try {
    const auth =
      (api.defaults.headers as any)?.common?.Authorization ??
      (api.defaults.headers as any)?.Authorization;

    const base = (import.meta as any).env?.VITE_API_URL as string | undefined;
    const url = base
      ? `${base.replace(/\/$/, "")}${PLAYBACK_ENDPOINTS.events}`
      : PLAYBACK_ENDPOINTS.events;

    await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(auth ? { Authorization: auth } : {}),
      },
      body: JSON.stringify(body),
      keepalive: true,
    });
  } catch {
    // drop
  }
}
