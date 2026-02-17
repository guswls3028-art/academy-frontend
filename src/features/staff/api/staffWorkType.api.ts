// PATH: src/features/staff/api/staffWorkType.api.ts
import api from "@/shared/api/axios";

/** Backend: WorkTypeSerializer */
export type WorkType = {
  id: number;
  name: string;
  base_hourly_wage: number;
  color: string;
  description: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

/** Backend: StaffWorkTypeSerializer (work_type nested, work_type_id write_only) */
export type StaffWorkType = {
  id: number;
  staff: number;
  work_type: WorkType;
  hourly_wage: number | null;
  effective_hourly_wage: number;
  created_at: string;
  updated_at: string;
};

/**
 * GET /staffs/work-types/
 */
export async function fetchWorkTypes(params?: { is_active?: boolean }) {
  const res = await api.get("/staffs/work-types/", { params });

  if (Array.isArray(res.data)) return res.data as WorkType[];
  if (Array.isArray(res.data?.results)) return res.data.results as WorkType[];
  return [];
}

/**
 * GET /staffs/{staff_id}/work-types/
 */
export async function fetchStaffWorkTypes(staffId: number) {
  const res = await api.get(`/staffs/${staffId}/work-types/`);

  if (Array.isArray(res.data)) return res.data as StaffWorkType[];
  if (Array.isArray(res.data?.results)) return res.data.results as StaffWorkType[];
  return [];
}

/**
 * POST /staffs/staff-work-types/
 */
export async function createStaffWorkType(
  staffId: number,
  payload: { work_type_id: number; hourly_wage?: number | null }
) {
  const res = await api.post("/staffs/staff-work-types/", { staff: staffId, ...payload });
  return res.data as StaffWorkType;
}

export async function patchStaffWorkType(
  id: number,
  payload: { hourly_wage?: number | null }
) {
  const res = await api.patch(`/staffs/staff-work-types/${id}/`, payload);
  return res.data as StaffWorkType;
}

export async function deleteStaffWorkType(id: number) {
  await api.delete(`/staffs/staff-work-types/${id}/`);
  return true;
}
