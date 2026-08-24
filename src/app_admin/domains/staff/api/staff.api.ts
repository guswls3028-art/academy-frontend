// PATH: src/app_admin/domains/staff/api/staff.api.ts
import api from "@/shared/api/axios";
import type { StaffWorkType } from "./staffWorkType.api";

export type StaffPosition = "DIRECTOR" | "INSTRUCTOR" | "ASSISTANT" | "STAFF";
export type StaffAccountRole = "OWNER" | "ADMIN" | "TEACHER" | "STAFF" | "NONE";

/** Backend: StaffListSerializer — 표시 직위와 계정 역할은 독립된 값이다. */
export type Staff = {
  id: number;
  name: string;
  phone: string;
  is_active: boolean;
  is_manager: boolean;
  can_manage_staff: boolean;
  pay_type: "HOURLY" | "MONTHLY";
  position: StaffPosition;
  position_label: string;
  role: "TEACHER" | "ASSISTANT";
  account_role: StaffAccountRole;
  staff_work_types: StaffWorkType[];
  created_at: string;
  updated_at: string;
};

/** 직원 목록 API 응답에 포함되는 원장(owner) — 목록 상단 표시용 */
export type StaffListOwner = {
  id: null;
  name: string;
  phone?: string | null;
  role: "OWNER";
  account_role: "OWNER";
  position: "OWNER";
  position_label: "대표";
  can_manage_staff: true;
  is_owner: true;
};

export type StaffListResponse = {
  staffs: Staff[];
  owner: StaffListOwner | null;
};

/**
 * Staff Summary (집계 전용)
 * 🔒 계산 단일진실
 */
export type StaffSummary = {
  staff_id: number;
  work_hours: number;
  work_amount: number;
  expense_amount: number;
  total_amount: number;
};

export type PayrollOverviewStatus =
  | "OPEN"
  | "NEEDS_REVIEW"
  | "CLOSED"
  | "RECONCILIATION_REQUIRED";

export type StaffPayrollOverviewRow = {
  staff_id: number;
  name: string;
  position: StaffPosition;
  position_label: string;
  account_role: StaffAccountRole;
  is_active: boolean;
  can_manage_staff: boolean;
  pay_type: "HOURLY" | "MONTHLY";
  work_hours: number;
  work_amount: number;
  approved_expense_amount: number;
  pending_expense_amount: number;
  pending_expense_count: number;
  total_amount: number;
  open_work_record_count: number;
  incomplete_work_record_count: number;
  assigned_work_type_count: number;
  settlement_status: PayrollOverviewStatus;
  can_close: boolean;
};

export type StaffPayrollOverview = {
  year: number;
  month: number;
  date_from: string;
  date_to: string;
  totals: {
    staff_count: number;
    work_hours: number;
    work_amount: number;
    approved_expense_amount: number;
    pending_expense_amount: number;
    total_amount: number;
    needs_review_count: number;
    closed_count: number;
  };
  rows: StaffPayrollOverviewRow[];
};

/**
 * GET /staffs/
 * 응답에 owner(원장) 포함 시 { staffs, owner } 반환.
 */
export async function fetchStaffs(params?: {
  search?: string;
  is_active?: boolean;
  is_manager?: boolean;
  pay_type?: string;
}): Promise<StaffListResponse> {
  const res = await api.get<
    Staff[] | { results?: Staff[]; owner?: StaffListOwner | null }
  >("/staffs/", {
    params: { ...params, page_size: 500 },
  });

  const raw = res.data;
  const staffs: Staff[] = Array.isArray(raw)
    ? raw
    : Array.isArray(raw.results)
      ? raw.results
      : [];
  const owner =
    !Array.isArray(raw) && raw.owner?.name
      ? raw.owner
      : null;

  return { staffs, owner };
}

export async function fetchStaffPayrollOverview(
  year: number,
  month: number,
) {
  const res = await api.get<StaffPayrollOverview>(
    "/staffs/payroll-overview/",
    { params: { year, month } },
  );
  return res.data;
}

/**
 * POST /staffs/
 * 🔒 생성 스펙 단일진실
 *
 * backend StaffCreateUpdateSerializer.role choices:
 * - role: 강의 배정이 가능한 강사 계정인지 여부
 * - position: 조직에서 표시할 직위
 */
export async function createStaff(payload: {
  username: string;
  password: string;
  name: string;
  phone?: string;
  role: "TEACHER" | "ASSISTANT";
  position: StaffPosition;
  is_manager: boolean;
}) {
  const res = await api.post("/staffs/", {
    username: payload.username,
    password: payload.password,
    name: payload.name,
    phone: payload.phone || undefined,
    role: payload.role,
    position: payload.position,
    is_manager: payload.is_manager,
  });

  return res.data as Staff;
}

/**
 * DELETE /staffs/{id}/
 */
export async function deleteStaff(id: number) {
  await api.delete(`/staffs/${id}/`);
  return true;
}
