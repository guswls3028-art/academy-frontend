// PATH: src/features/clinic/api/clinicSessions.api.ts
import api from "@/shared/api/axios";

export type ClinicSessionTreeNode = {
  id: number;
  date: string; // YYYY-MM-DD
  start_time: string; // "HH:MM:SS" or "HH:MM"
  location: string;

  participant_count: number;
  booked_count: number;
  no_show_count: number;
};

/**
 * 운영 좌측 트리 전용
 * GET /clinic/sessions/tree/?year=YYYY&month=MM
 */
export async function fetchClinicSessionTree(params: {
  year: number;
  month: number; // 1~12
}) {
  const res = await api.get("/clinic/sessions/tree/", { params });

  if (Array.isArray(res.data)) return res.data as ClinicSessionTreeNode[];
  if (Array.isArray(res.data?.results)) return res.data.results as ClinicSessionTreeNode[];
  return [];
}
