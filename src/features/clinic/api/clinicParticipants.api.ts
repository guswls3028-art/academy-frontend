// PATH: src/features/clinic/api/clinicParticipants.api.ts
import api from "@/shared/api/axios";

export type ClinicParticipantStatus =
  | "pending"
  | "booked"
  | "attended"
  | "no_show"
  | "cancelled"
  | "rejected";

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
  session_start_time: string;
  session_end_time?: string;
  session_location: string;

  status: ClinicParticipantStatus;
  memo?: string;

  // 학생 SSOT 표시용
  lecture_title?: string | null;
  lecture_color?: string | null;
  lecture_chip_label?: string | null;
  name_highlight_clinic_target?: boolean;
  profile_photo_url?: string | null;

  completed_at?: string | null;
  completed_by_name?: string | null;
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
  payload: { status: ClinicParticipantStatus; memo?: string }
) {
  const res = await api.patch(`/clinic/participants/${id}/set_status/`, payload);
  return res.data as ClinicParticipant;
}

export async function completeClinicParticipant(id: number) {
  const res = await api.post(`/clinic/participants/${id}/complete/`);
  return res.data as ClinicParticipant;
}

export async function uncompleteClinicParticipant(id: number) {
  const res = await api.post(`/clinic/participants/${id}/uncomplete/`);
  return res.data as ClinicParticipant;
}
