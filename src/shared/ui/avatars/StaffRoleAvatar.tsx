// PATH: src/shared/ui/avatars/StaffRoleAvatar.tsx
// 직원 역할 아바타 — 대표(왕관) / 강사(학사모) / 조교 (직원관리·설정 내 정보 공용)

import { Crown, GraduationCap, UserCog } from "lucide-react";

export type StaffRoleType = "owner" | "TEACHER" | "ASSISTANT";

type StaffRoleAvatarProps = {
  role: StaffRoleType;
  size?: number;
  className?: string;
  "aria-label"?: string;
};

const LABELS: Record<StaffRoleType, string> = {
  owner: "대표",
  TEACHER: "강사",
  ASSISTANT: "조교",
};

export default function StaffRoleAvatar({
  role,
  size = 24,
  className = "",
  "aria-label": ariaLabel,
}: StaffRoleAvatarProps) {
  const label = ariaLabel ?? LABELS[role];
  const cn = `shrink-0 text-[var(--color-text-secondary)] ${className}`.trim();
  if (role === "owner") return <Crown size={size} className={cn} aria-label={label} />;
  if (role === "TEACHER") return <GraduationCap size={size} className={cn} aria-label={label} />;
  return <UserCog size={size} className={cn} aria-label={label} />;
}
