// PATH: src/features/staff/api/staff.api.ts
import api from "@/shared/api/axios";
import type { StaffWorkType } from "./staffWorkType.api";

/** Backend: StaffListSerializer — role: TEACHER(강사) | ASSISTANT(조교) */
export type Staff = {
  id: number;
  name: string;
  phone: string;
  is_active: boolean;
  is_manager: boolean;
  pay_type: "HOURLY" | "MONTHLY";
  role: "TEACHER" | "ASSISTANT";
  staff_work_types: StaffWorkType[];
  created_at: string;
  updated_at: string;
};

/** 직원 목록 API 응답에 포함되는 원장(owner) — 목록 상단 표시용 */
export type StaffListOwner = {
  id: null;
  name: string;
  role: "OWNER";
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
  const res = await api.get<{ results?: Staff[]; owner?: StaffListOwner | null } & Staff[]>("/staffs/", {
    params,
  });

  const staffs: Staff[] = Array.isArray(res.data)
    ? (res.data as Staff[])
    : Array.isArray(res.data?.results)
      ? (res.data.results as Staff[])
      : [];
  const owner =
    res.data && typeof res.data === "object" && "owner" in res.data
      ? (res.data.owner as StaffListOwner | null) ?? null
      : null;

  return { staffs, owner };
}

/**
 * POST /staffs/
 * 🔒 생성 스펙 단일진실
 *
 * backend StaffCreateUpdateSerializer.role choices:
 * - TEACHER : 강사
 * - ASSISTANT : 조교
 */
export async function createStaff(payload: {
  username: string;
  password: string;
  name: string;
  phone?: string;
  role: "TEACHER" | "ASSISTANT";
}) {
  const res = await api.post("/staffs/", {
    username: payload.username,
    password: payload.password,
    name: payload.name,
    phone: payload.phone || undefined,
    role: payload.role,
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
