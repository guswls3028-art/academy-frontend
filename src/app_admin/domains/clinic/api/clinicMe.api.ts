import api from "@/shared/api/axios";

/**
 * 권한 단일진실
 * - 스태프/관리자 UX 분기
 * - (staff 도메인과 동일 스펙을 clinic에서 독립 사용)
 */
export type ClinicMe = {
  is_authenticated: boolean;
  is_superuser: boolean;
  is_staff: boolean;
  is_payroll_manager: boolean;
};

export async function fetchClinicMe() {
  const res = await api.get("/staffs/me/");
  return res.data as ClinicMe;
}
