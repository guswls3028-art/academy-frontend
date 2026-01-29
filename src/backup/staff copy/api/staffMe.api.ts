// PATH: src/features/staff/api/staffMe.api.ts
import api from "@/shared/api/axios";

export type StaffMe = {
  is_authenticated: boolean;
  is_superuser: boolean;
  is_staff: boolean;
  is_payroll_manager: boolean;
};

export async function fetchStaffMe() {
  const res = await api.get("/staffs/me/");
  return res.data as StaffMe;
}
