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

  student_name: string;
  enrollment_id?: number;
  clinic_reason?: "exam" | "homework" | "both";

  session_date: string;
  session_start_time: string;
  session_end_time?: string;
  session_location: string;

  status: ClinicParticipantStatus;
  memo?: string;
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

export async function patchClinicParticipantStatus(
  id: number,
  payload: { status: ClinicParticipantStatus; memo?: string }
) {
  const res = await api.patch(`/clinic/participants/${id}/set_status/`, payload);
  return res.data as ClinicParticipant;
}
