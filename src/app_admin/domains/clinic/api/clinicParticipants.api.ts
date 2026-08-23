// PATH: src/app_admin/domains/clinic/api/clinicParticipants.api.ts
import api from "@/shared/api/axios";

export type ClinicParticipantStatus =
  | "pending"
  | "booked"
  | "attended"
  | "no_show"
  | "cancelled"
  | "rejected";

export type ClinicRecipient = "student" | "parent" | "both";

export type ClinicParticipant = {
  id: number;

  // ✅ 백엔드 단일진실: session FK
  session: number;

  /** student PK (백엔드 fields="__all__"로 포함) */
  student: number;
  student_name: string;
  enrollment_id?: number;
  clinic_reason?: "exam" | "homework" | "both";

  session_date: string;
  session_title?: string | null;
  session_start_time: string;
  session_end_time?: string;
  session_location: string;

  status: ClinicParticipantStatus;
  memo?: string;
  checked_in_at?: string | null;
  is_late?: boolean;
  checked_out_at?: string | null;
  checked_out_by_name?: string | null;

  // 학생 SSOT 표시용
  lecture_title?: string | null;
  lecture_color?: string | null;
  lecture_chip_label?: string | null;
  name_highlight_clinic_target?: boolean;
  profile_photo_url?: string | null;

  completed_at?: string | null;
  completed_by_name?: string | null;
  planned_clinic_link_ids?: number[];
};

export async function fetchClinicParticipants(params: {
  session?: number; // ParticipantFilter.session (session_id)
  session_date_from?: string;
  session_date_to?: string;
  status?: ClinicParticipantStatus;
}) {
  const res = await api.get("/clinic/participants/", { params });

  // ✅ pagination 대응
  if (Array.isArray(res.data)) return res.data as ClinicParticipant[];
  if (Array.isArray(res.data?.results)) return res.data.results as ClinicParticipant[];
  return [];
}

export async function createClinicParticipant(payload: {
  session: number;
  enrollment_id?: number;
  student?: number;
  status?: ClinicParticipantStatus;
  memo?: string;
  source?: string;
  clinic_reason?: "exam" | "homework" | "both";
}) {
  const res = await api.post("/clinic/participants/", payload);
  return res.data as ClinicParticipant;
}

export async function patchClinicParticipantStatus(
  id: number,
  payload: {
    status: ClinicParticipantStatus;
    memo?: string;
    is_late?: boolean;
    send_to?: ClinicRecipient;
  }
) {
  const res = await api.patch(`/clinic/participants/${id}/set_status/`, payload);
  return res.data as ClinicParticipant;
}

export type ClinicParticipantReminderResult = {
  ok: true;
  status: "ok";
  sent: number;
  scheduled?: number;
  skipped: number;
};

export async function remindClinicParticipant(
  id: number,
  payload: {
    mode: "once" | "repeat";
    send_to: ClinicRecipient;
    interval_minutes?: number;
    repeat_until?: string;
  },
) {
  const res = await api.post<ClinicParticipantReminderResult>(
    `/clinic/participants/${id}/remind/`,
    payload,
  );
  return res.data;
}

export async function checkoutClinicParticipant(
  id: number,
  payload: { send_to: ClinicRecipient },
) {
  const res = await api.post(`/clinic/participants/${id}/checkout/`, payload);
  return res.data as ClinicParticipant;
}

export async function replaceClinicParticipantPlan(
  id: number,
  plannedClinicLinkIds: number[],
) {
  const res = await api.put(
    `/clinic/participants/${id}/planned-clinic-links/`,
    { planned_clinic_link_ids: plannedClinicLinkIds },
  );
  return res.data as ClinicParticipant;
}

export async function changeClinicParticipantBooking(
  id: number,
  payload: { new_session_id: number; memo?: string; send_to: ClinicRecipient },
) {
  const res = await api.post(`/clinic/participants/${id}/change-booking/`, payload);
  return res.data as ClinicParticipant;
}

export async function completeClinicParticipant(
  id: number,
  payload: { send_to?: ClinicRecipient } = {},
) {
  const res = await api.post(`/clinic/participants/${id}/complete/`, payload);
  return res.data as ClinicParticipant;
}

export async function uncompleteClinicParticipant(id: number) {
  const res = await api.post(`/clinic/participants/${id}/uncomplete/`);
  return res.data as ClinicParticipant;
}
