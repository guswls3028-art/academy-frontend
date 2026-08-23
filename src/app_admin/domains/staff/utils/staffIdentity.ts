import type {
  StaffAccountRole,
  StaffPosition,
} from "../api/staff.api";

export const STAFF_POSITION_OPTIONS: Array<{
  value: StaffPosition;
  label: string;
  description: string;
}> = [
  { value: "DIRECTOR", label: "실장", description: "학원 운영 책임자" },
  { value: "INSTRUCTOR", label: "강사", description: "수업 담당 직위" },
  { value: "ASSISTANT", label: "조교", description: "수업·클리닉 보조" },
  { value: "STAFF", label: "직원", description: "일반 운영 직원" },
];

export function staffPositionLabel(
  position: StaffPosition | "OWNER" | undefined,
  legacyRole?: "TEACHER" | "ASSISTANT" | "OWNER",
) {
  if (position === "OWNER") return "대표";
  const configured = STAFF_POSITION_OPTIONS.find((option) => option.value === position)?.label;
  if (configured) return configured;
  if (legacyRole === "OWNER") return "대표";
  if (legacyRole === "TEACHER") return "강사";
  if (legacyRole === "ASSISTANT") return "조교";
  return "직원";
}

export function staffAccountRoleLabel(
  role: StaffAccountRole | undefined,
  legacyRole?: "TEACHER" | "ASSISTANT" | "OWNER",
) {
  if (role === "OWNER") return "대표 계정";
  if (role === "ADMIN") return "관리자 계정";
  if (role === "TEACHER") return "강사 계정";
  if (role === "STAFF") return "직원 계정";
  if (legacyRole === "OWNER") return "대표 계정";
  if (legacyRole === "TEACHER") return "강사 계정";
  if (legacyRole === "ASSISTANT") return "직원 계정";
  return "계정 없음";
}

export function canEditStaffAccountRole(role: StaffAccountRole | undefined) {
  return role !== "OWNER" && role !== "ADMIN";
}
