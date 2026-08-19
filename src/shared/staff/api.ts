import api from "@/shared/api/axios";

export type AssignedWorkType = {
  id: number;
  name: string;
  hourly_wage: number;
};

export type StaffMe = {
  is_authenticated: boolean;
  is_superuser: boolean;
  is_staff: boolean;
  is_payroll_manager: boolean;
  is_owner?: boolean;
  owner_display_name?: string | null;
  owner_phone?: string | null;
  staff_id?: number;
  default_work_type_id?: number;
  assigned_work_types?: AssignedWorkType[];
};

/** Canonical tenant-scoped staff identity and work assignments. */
export async function fetchStaffMe(): Promise<StaffMe> {
  const { data } = await api.get<StaffMe>("/staffs/me/");
  return data;
}
