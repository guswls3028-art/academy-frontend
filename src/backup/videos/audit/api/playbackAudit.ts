import api from "@/shared/api/axios";

export function fetchPlaybackSessions(videoId: number) {
  return api
    .get(`/media/admin/videos/${videoId}/sessions/`)
    .then(res => res.data);
}

export function fetchPlaybackEvents(sessionId: string) {
  return api
    .get(`/media/admin/playback-sessions/${sessionId}/events/`)
    .then(res => res.data);
}
