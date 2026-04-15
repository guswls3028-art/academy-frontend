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
