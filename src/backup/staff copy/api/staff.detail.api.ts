// PATH: src/features/staff/api/staff.detail.api.ts
import api from "@/shared/api/axios";
import { Staff, StaffSummary } from "./staff.api";

export type StaffDetail = Staff & {
  user: number | null;

  // 🔥 추가 (read-only)
  user_username?: string | null;
  user_is_staff?: boolean;

  created_at?: string;
  updated_at?: string;
};

export const fetchStaffDetail = async (id: number) => {
  const res = await api.get(`/staffs/${id}/`);
  return res.data as StaffDetail;
};

export const patchStaffDetail = async (
  id: number,
  payload: Partial<StaffDetail>
) => {
  const res = await api.patch(`/staffs/${id}/`, payload);
  return res.data as StaffDetail;
};

export const fetchStaffSummaryByRange = async (
  staffId: number,
  date_from: string,
  date_to: string
) => {
  const res = await api.get(`/staffs/${staffId}/summary/`, {
    params: { date_from, date_to },
  });
  return res.data as StaffSummary;
};
