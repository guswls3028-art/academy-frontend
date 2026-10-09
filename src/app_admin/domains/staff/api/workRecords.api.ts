// PATH: src/app_admin/domains/staff/api/workRecords.api.ts
import api from "@/shared/api/axios";
import { fetchStaffPages } from "@/shared/staff/fetchStaffPages";
import type { components } from "@/shared/api/generated/schema";

/** Backend: WorkRecordSerializer — 급여 상세 화면의 정본 필드. */
export type WorkRecord = components["schemas"]["StaffWorkRecord"];

/**
 * GET /staffs/work-records/
 */
export async function fetchWorkRecords(params: {
  staff: number;
  work_type?: number;
  date_from: string;
  date_to: string;
}) {
  const { rows } = await fetchStaffPages<WorkRecord>("/staffs/work-records/", params);
  return rows;
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
  end_date?: string | null;
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
    end_date: string | null;
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
