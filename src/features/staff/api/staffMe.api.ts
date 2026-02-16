// PATH: src/features/staff/api/staffMe.api.ts
import api from "@/shared/api/axios";

export type StaffMe = {
  is_authenticated: boolean;
  is_superuser: boolean;
  is_staff: boolean;
  is_payroll_manager: boolean;
  /** 현재 사용자가 이 테넌트 원장(owner)일 때 true. 직원 목록 원장 행 표시용 */
  is_owner?: boolean;
  /** is_owner 일 때 표시할 이름 (list API에 owner 없을 때 사용) */
  owner_display_name?: string | null;
};

/**
 * 🔒 단일진실
 * - 권한 판단은 무조건 이 API 기준
 */
export async function fetchStaffMe() {
  const res = await api.get("/staffs/me/");
  return res.data as StaffMe;
}
