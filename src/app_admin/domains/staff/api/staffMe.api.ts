// PATH: src/app_admin/domains/staff/api/staffMe.api.ts
import api from "@/shared/api/axios";

export type StaffMe = {
  is_authenticated: boolean;
  is_superuser: boolean;
  is_staff: boolean;
  is_payroll_manager: boolean;
  /** 현재 사용자가 이 테넌트 원장(owner)일 때 true. 직원 목록 원장 행 표시용 */
  is_owner?: boolean;
  /** 원장 행 표시용 이름 (list API에 owner 없을 때 사용) */
  owner_display_name?: string | null;
  /** 원장 행 표시용 전화번호 */
  owner_phone?: string | null;
  /** 직원(Staff)으로 로그인한 경우: 출근/퇴근용 */
  staff_id?: number;
  /** 활성 배정이 정확히 하나일 때만 제공되는 기본 work_type id */
  default_work_type_id?: number;
  /** 현재 테넌트에서 본인에게 배정된 활성 근무 유형 */
  assigned_work_types?: Array<{
    id: number;
    name: string;
    hourly_wage: number;
  }>;
};

/**
 * 🔒 단일진실
 * - 권한 판단은 무조건 이 API 기준
 */
export async function fetchStaffMe() {
  const res = await api.get("/staffs/me/");
  return res.data as StaffMe;
}
