// PATH: src/app_teacher/domains/clinic/api.ts
// 클리닉 API — 기존 admin clinic API 재사용
import api from "@/shared/api/axios";

/** 오늘 날짜 기준 클리닉 세션 목록 */
export async function fetchClinicSessions(params: {
  date_from: string;
  date_to: string;
}) {
  const res = await api.get("/clinic/sessions/", { params });
  const raw = res.data;
  return Array.isArray(raw?.results) ? raw.results : Array.isArray(raw) ? raw : [];
}

/** 클리닉 세션의 참가자 목록 */
export async function fetchClinicParticipants(sessionId: number) {
  const res = await api.get("/clinic/participants/", {
    params: { session: sessionId, page_size: 200 },
  });
  const raw = res.data;
  return Array.isArray(raw?.results) ? raw.results : Array.isArray(raw) ? raw : [];
}

/** 참가자 상태 변경 (출석/결석) */
export async function patchParticipantStatus(
  participantId: number,
  payload: { status: string; memo?: string },
) {
  const res = await api.patch(`/clinic/participants/${participantId}/set_status/`, payload);
  return res.data;
}

/** 참가자 완료 처리 */
export async function completeParticipant(participantId: number) {
  const res = await api.post(`/clinic/participants/${participantId}/complete/`);
  return res.data;
}

/* ─── Session CRUD ─── */
export async function createClinicSession(payload: {
  title: string;
  date: string;
  start_time?: string;
  end_time?: string;
  location?: string;
  max_capacity?: number;
}) {
  const res = await api.post("/clinic/sessions/", payload);
  return res.data;
}

export async function updateClinicSession(sessionId: number, payload: Record<string, unknown>) {
  const res = await api.patch(`/clinic/sessions/${sessionId}/`, payload);
  return res.data;
}

export async function deleteClinicSession(sessionId: number) {
  await api.delete(`/clinic/sessions/${sessionId}/`);
}

/* ─── Participant CRUD ─── */
export async function createClinicParticipant(payload: {
  session: number;
  student?: number;
  enrollment_id?: number;
  memo?: string;
  clinic_reason?: string;
}) {
  const res = await api.post("/clinic/participants/", payload);
  return res.data;
}

/* ─── Settings ─── */
export async function fetchClinicSettings() {
  const res = await api.get("/clinic/settings/");
  return res.data;
}

export async function updateClinicSettings(payload: { auto_approve_booking?: boolean; use_daily_random?: boolean }) {
  const res = await api.patch("/clinic/settings/", payload);
  return res.data;
}

/* ─── Targets ─── */
export async function fetchClinicTargets(params?: { section_id?: number }) {
  const res = await api.get("/clinic/targets/", { params });
  const raw = res.data;
  return Array.isArray(raw?.results) ? raw.results : Array.isArray(raw) ? raw : [];
}
