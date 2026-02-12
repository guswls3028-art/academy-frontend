// PATH: src/features/staff/api/workRecords.api.ts
import api from "@/shared/api/axios";

/** Backend: WorkRecordSerializer (resolved_hourly_wage, current_break_started_at not exposed) */
export type WorkRecord = {
  id: number;
  staff: number;
  staff_name: string;
  work_type: number;
  work_type_name: string;
  date: string;
  start_time: string;
  end_time: string | null;
  break_minutes: number;
  work_hours: number | null;
  amount: number | null;
  memo: string;
  created_at: string;
  updated_at: string;
};

/**
 * GET /staffs/work-records/
 */
export async function fetchWorkRecords(params: {
  staff: number;
  work_type?: number;
  date_from: string;
  date_to: string;
}) {
  const res = await api.get("/staffs/work-records/", { params });

  if (Array.isArray(res.data)) return res.data as WorkRecord[];
  if (Array.isArray(res.data?.results)) return res.data.results as WorkRecord[];
  return [];
}

/**
 * POST /staffs/work-records/
 */
export async function createWorkRecord(payload: {
  staff: number;
  work_type: number;
  date: string;
  start_time: string;
  end_time: string;
  break_minutes?: number;
  memo?: string;
}) {
  const res = await api.post("/staffs/work-records/", payload);
  return res.data as WorkRecord;
}

export async function patchWorkRecord(
  id: number,
  payload: Partial<{
    work_type: number;
    date: string;
    start_time: string;
    end_time: string;
    break_minutes: number;
    memo: string;
  }>
) {
  const res = await api.patch(`/staffs/work-records/${id}/`, payload);
  return res.data as WorkRecord;
}

export async function deleteWorkRecord(id: number) {
  await api.delete(`/staffs/work-records/${id}/`);
  return true;
}
