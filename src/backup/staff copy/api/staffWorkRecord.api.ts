// PATH: src/features/staff/api/staffWorkRecord.api.ts
import api from "@/shared/api/axios";

export type WorkRecord = {
  id: number;
  staff: number;
  staff_name?: string;
  work_type: number;
  work_type_name?: string;
  date: string; // YYYY-MM-DD
  start_time: string; // HH:MM:SS (or HH:MM)
  end_time: string;
  break_minutes: number;
  work_hours: string | number | null; // decimal
  amount: number | null;
  memo: string;
  created_at?: string;
  updated_at?: string;
};

export const fetchWorkRecords = async (params: {
  staff: number;
  date_from: string;
  date_to: string;
}) => {
  const res = await api.get("/work-records/", { params });
  return res.data as WorkRecord[];
};

export const createWorkRecord = async (payload: {
  staff: number;
  work_type: number;
  date: string;
  start_time: string;
  end_time: string;
  break_minutes?: number;
  memo?: string;
}) => {
  const res = await api.post("/work-records/", payload);
  return res.data as WorkRecord;
};

export const patchWorkRecord = async (
  id: number,
  payload: Partial<{
    work_type: number;
    date: string;
    start_time: string;
    end_time: string;
    break_minutes: number;
    memo: string;
  }>
) => {
  const res = await api.patch(`/work-records/${id}/`, payload);
  return res.data as WorkRecord;
};

export const deleteWorkRecord = async (id: number) => {
  await api.delete(`/work-records/${id}/`);
  return true;
};
