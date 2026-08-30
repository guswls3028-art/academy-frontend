// PATH: src/app_teacher/domains/clinic/api.ts
// 클리닉 API — 기존 admin clinic API 재사용
import api from "@/shared/api/axios";
import { listFromApiResponse } from "@/shared/api/response";

export type TeacherClinicSession = {
  id: number;
  title?: string | null;
  date?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  duration_minutes?: number | null;
  location?: string | null;
  participant_count?: number | null;
  booked_count?: number | null;
  max_participants?: number | null;
  is_full?: boolean | null;
};

export type TeacherClinicParticipantStatus =
  | "booked"
  | "attended"
  | "no_show"
  | "cancelled"
  | "rejected"
  | string;

export type TeacherClinicRecipient = "student" | "parent" | "both";

export type TeacherClinicParticipant = {
  id: number;
  session?: number | null;
  student?: number | null;
  student_name?: string | null;
  enrollment_name?: string | null;
  status?: TeacherClinicParticipantStatus | null;
  checked_in_at?: string | null;
  checked_out_at?: string | null;
  is_late?: boolean | null;
  completed_at?: string | null;
  is_completed?: boolean | null;
  planned_clinic_link_ids?: number[];
  profile_photo_url?: string | null;
  lecture_title?: string | null;
  lecture_color?: string | null;
  lecture_chip_label?: string | null;
};

/** 오늘 날짜 기준 클리닉 세션 목록 */
export async function fetchClinicSessions(params: {
  date_from: string;
  date_to: string;
}): Promise<TeacherClinicSession[]> {
  const res = await api.get("/clinic/sessions/", { params });
  return listFromApiResponse<TeacherClinicSession>(res.data);
}

/** 클리닉 세션의 참가자 목록 */
export async function fetchClinicParticipants(sessionId: number): Promise<TeacherClinicParticipant[]> {
  const res = await api.get("/clinic/participants/", {
    params: { session: sessionId, page_size: 200 },
  });
  return listFromApiResponse<TeacherClinicParticipant>(res.data);
}

/** 참가자 상태 변경 (출석/결석) */
export async function patchParticipantStatus(
  participantId: number,
  payload: {
    status: TeacherClinicParticipantStatus;
    memo?: string;
    is_late?: boolean;
    send_to?: TeacherClinicRecipient;
  },
): Promise<TeacherClinicParticipant> {
  const res = await api.patch(`/clinic/participants/${participantId}/set_status/`, payload);
  return res.data;
}

export async function remindParticipant(
  participantId: number,
  payload: {
    mode: "once" | "repeat";
    send_to: TeacherClinicRecipient;
    interval_minutes?: number;
    repeat_until?: string;
  },
): Promise<void> {
  await api.post(`/clinic/participants/${participantId}/remind/`, payload);
}

export async function checkoutParticipant(
  participantId: number,
  payload: { send_to: TeacherClinicRecipient },
): Promise<TeacherClinicParticipant> {
  const res = await api.post(`/clinic/participants/${participantId}/checkout/`, payload);
  return res.data;
}

export async function changeParticipantBooking(
  participantId: number,
  payload: {
    new_session_id: number;
    memo?: string;
    send_to: TeacherClinicRecipient;
  },
): Promise<TeacherClinicParticipant> {
  const res = await api.post(`/clinic/participants/${participantId}/change-booking/`, payload);
  return res.data;
}

/** 참가자 완료 처리 */
export async function completeParticipant(
  participantId: number,
  payload: { send_to?: TeacherClinicRecipient } = {},
): Promise<TeacherClinicParticipant> {
  const res = await api.post(`/clinic/participants/${participantId}/complete/`, payload);
  return res.data;
}

/* ─── Session CRUD ─── */
export async function createClinicSession(payload: {
  title?: string;
  date: string;
  start_time: string;
  duration_minutes?: number;
  location: string;
  max_participants: number;
  target_grade?: number | null;
  target_school_type?: string | null;
  section?: number | null;
}): Promise<TeacherClinicSession> {
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
}): Promise<TeacherClinicParticipant> {
  const res = await api.post("/clinic/participants/", payload);
  return res.data;
}

export async function createClinicParticipantsBulk(payload: {
  session_ids: number[];
  student_ids: number[];
}): Promise<{ count: number; participants: TeacherClinicParticipant[] }> {
  const res = await api.post("/clinic/participants/bulk-create/", payload);
  return res.data;
}

/* ─── Passcard settings ─── */
export type ClinicColorTuple = [string, string, string];

export type ClinicSettingsPayload = {
  auto_approve_booking?: boolean;
  use_daily_random?: boolean;
  colors?: ClinicColorTuple;
};

export type ClinicSettings = ClinicSettingsPayload & {
  saved_colors?: ClinicColorTuple;
};

export async function fetchClinicSettings(): Promise<ClinicSettings> {
  const res = await api.get<ClinicSettings>("/clinic/settings/");
  return res.data;
}

export async function updateClinicSettings(payload: ClinicSettingsPayload): Promise<ClinicSettings> {
  const res = await api.patch<ClinicSettings>("/clinic/settings/", payload);
  return res.data;
}

/* ─── Targets ─── */
export async function fetchClinicTargets(params?: { section_id?: number }) {
  const res = await api.get("/clinic/targets/", { params });
  const raw = res.data;
  return Array.isArray(raw?.results) ? raw.results : Array.isArray(raw) ? raw : [];
}

/* ─── ClinicLink (학습 실패 → 클리닉 대상 연결 SSOT) ─── */
// 차시 진입 시 "이 차시에서 어느 학생이 클리닉 대상인지" 보여주는 본질 데이터.
// ClinicSession (날짜의 클리닉 스케줄) 과 다른 개념: ClinicLink 는 학생×차시 매핑.
export type ClinicLinkRow = {
  id: number;
  enrollment_id: number;
  session: number;
  session_title: string;
  lecture_title: string;
  student_name: string;
  reason: string;
  is_auto: boolean;
  approved: boolean;
  resolved_at: string | null;
  resolution_type: string | null;
  cycle_no: number;
  memo: string | null;
  meta: Record<string, unknown> | null;
};

export async function fetchSessionClinicLinks(sessionId: number, opts?: { unresolvedOnly?: boolean }) {
  const params: Record<string, string | number | boolean> = {
    session: sessionId,
    page_size: 200,
  };
  if (opts?.unresolvedOnly) params.unresolved_only = "true";
  const res = await api.get("/progress/clinic-links/", { params });
  const raw = res.data;
  const list: ClinicLinkRow[] = Array.isArray(raw?.results)
    ? raw.results
    : Array.isArray(raw)
    ? raw
    : [];
  return list;
}
