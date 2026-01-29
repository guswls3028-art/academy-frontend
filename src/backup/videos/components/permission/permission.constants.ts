// src/features/videos/components/permission/permission.constants.ts

export const ATT_LABELS: Record<string, string> = {
  PRESENT: "출석",
  LATE: "지각",
  ONLINE: "영상",
  SUPPLEMENT: "보강",
  EARLY_LEAVE: "조퇴",
  ABSENT: "결석",
  RUNAWAY: "출튀",
  MATERIAL: "자료",
  INACTIVE: "부재",
  SECESSION: "탈퇴",
};

export const ATT_COLORS: Record<string, string> = {
  PRESENT: "bg-blue-500",
  LATE: "bg-yellow-500",
  ONLINE: "bg-purple-500",
  SUPPLEMENT: "bg-teal-500",
  EARLY_LEAVE: "bg-orange-500",
  ABSENT: "bg-red-500",
  RUNAWAY: "bg-red-600",
  MATERIAL: "bg-cyan-600",
  INACTIVE: "bg-gray-500",
  SECESSION: "bg-gray-400",
};

export const RULE_LABELS: Record<string, string> = {
  free: "무제한",
  once: "1회 제한",
  blocked: "제한",
};

export const RULE_COLORS: Record<string, string> = {
  free: "bg-green-500",
  once: "bg-blue-500",
  blocked: "bg-red-500",
};
