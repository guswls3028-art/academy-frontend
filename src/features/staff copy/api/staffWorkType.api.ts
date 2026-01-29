// PATH: src/features/staff/api/staffWorkType.api.ts
import api from "@/shared/api/axios";

export type WorkType = {
  id: number;
  name: string;
  base_hourly_wage: number;
  color: string;
  is_active?: boolean;
};

export type StaffWorkType = {
  id: number;
  staff: number;
  work_type: WorkType;
  hourly_wage: number | null;
  effective_hourly_wage: number;
  created_at?: string;
  updated_at?: string;
};

export const fetchWorkTypes = async (params?: { is_active?: boolean }) => {
  const res = await api.get("/staffs/work-types/", { params });
  return res.data as WorkType[];
};

export const fetchStaffWorkTypes = async (staffId: number) => {
  const res = await api.get(`/staffs/${staffId}/work-types/`);
  return res.data as StaffWorkType[];
};

export const createStaffWorkType = async (
  staffId: number,
  payload: { work_type_id: number; hourly_wage?: number | null }
) => {
  const res = await api.post(`/staffs/${staffId}/work-types/`, payload);
  // backend는 생성 후 해당 staff의 전체 목록을 반환
  return res.data as StaffWorkType[];
};

export const patchStaffWorkType = async (
  id: number,
  payload: { hourly_wage?: number | null }
) => {
  const res = await api.patch(`/staff-work-types/${id}/`, payload);
  return res.data as StaffWorkType;
};

export const deleteStaffWorkType = async (id: number) => {
  await api.delete(`/staff-work-types/${id}/`);
  return true;
};
