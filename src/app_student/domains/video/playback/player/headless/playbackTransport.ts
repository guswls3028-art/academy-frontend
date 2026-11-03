import studentApi from "@student/shared/api/student.api";
import type { EventType } from "./controllerTypes";

export async function postHeartbeat(token: string) {
  if (token.startsWith("student-")) return;
  try {
    await studentApi.post(`/media/playback/heartbeat/`, { token });
  } catch {
    // Legacy telemetry is best effort.
  }
}

export async function postRefresh(token: string) {
  if (token.startsWith("student-")) return;
  await studentApi.post(`/media/playback/refresh/`, { token });
}

export async function postEvents(
  token: string,
  events: Array<{ type: EventType; occurred_at: number; payload?: Record<string, unknown> }>,
  videoId: number,
  enrollmentId: number | null
) {
  if (!events.length || token.startsWith("student-")) return;
  try {
    await studentApi.post(`/media/playback/events/`, {
      token,
      video_id: videoId,
      enrollment_id: enrollmentId,
      events: events.map((e) => ({ type: e.type, occurred_at: e.occurred_at, payload: e.payload || {} })),
    });
  } catch {
    // Legacy telemetry is best effort.
  }
}
