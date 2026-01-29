// PATH: src/features/staff/api/staff.detail.api.ts
import api from "@/shared/api/axios";
import { Staff, StaffSummary } from "./staff.api";

export type StaffDetail = Staff & {
  user: number | null;
  user_username?: string | null;
  user_is_staff?: boolean;
};

/**
 * GET /staffs/{id}/
 */
export async function fetchStaffDetail(id: number) {
  const res = await api.get(`/staffs/${id}/`);
  return res.data as StaffDetail;
}

/**
 * PATCH /staffs/{id}/
 */
export async function patchStaffDetail(
  id: number,
  payload: Partial<StaffDetail>
) {
  const res = await api.patch(`/staffs/${id}/`, payload);
  return res.data as StaffDetail;
}

/**
 * 🔒 집계 단일진실
 */
export async function fetchStaffSummaryByRange(
  staffId: number,
  date_from: string,
  date_to: string
) {
  const res = await api.get(`/staffs/${staffId}/summary/`, {
    params: { date_from, date_to },
  });
  return res.data as StaffSummary;
}
