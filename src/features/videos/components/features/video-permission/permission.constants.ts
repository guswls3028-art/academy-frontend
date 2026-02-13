// PATH: src/features/videos/components/features/video-permission/permission.constants.ts

/**
 * ✅ permission.constants (UI v2)
 * - "출결"은 공용 AttendanceBadge를 쓰는 쪽으로 정리 (PermissionRow에서 사용)
 * - 여기서는 기존 계약을 깨지 않기 위해 LABEL은 유지
 * - 색상은 Tailwind 고정색 → theme var 기반으로 변경 (대기업 SaaS 룩)
 */

export const ATT_LABELS: Record<string, string> = {
  PRESENT: "현장",
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

/**
 * ⚠️ 기존 ATT_COLORS는 레거시 호환용 유지
 * - PermissionRow에서는 AttendanceBadge로 교체되어 직접 사용 빈도 ↓
 * - 남아있는 화면이 있으면 최소한 테마에 맞게 보이도록만 유지
 */
export const ATT_COLORS: Record<string, string> = {
  PRESENT: "bg-[color-mix(in_srgb,var(--color-primary)_18%,transparent)] text-[var(--color-primary)]",
  LATE: "bg-[color-mix(in_srgb,var(--color-warning)_18%,transparent)] text-[var(--color-warning)]",
  ONLINE: "bg-[color-mix(in_srgb,var(--color-primary)_14%,transparent)] text-[var(--color-primary)]",
  SUPPLEMENT: "bg-[color-mix(in_srgb,var(--color-primary)_10%,transparent)] text-[var(--text-primary)]",
  EARLY_LEAVE: "bg-[color-mix(in_srgb,var(--color-warning)_14%,transparent)] text-[var(--color-warning)]",
  ABSENT: "bg-[color-mix(in_srgb,var(--color-danger)_18%,transparent)] text-[var(--color-danger)]",
  RUNAWAY: "bg-[color-mix(in_srgb,var(--color-danger)_18%,transparent)] text-[var(--color-danger)]",
  MATERIAL: "bg-[color-mix(in_srgb,var(--text-muted)_16%,transparent)] text-[var(--text-secondary)]",
  INACTIVE: "bg-[color-mix(in_srgb,var(--text-muted)_16%,transparent)] text-[var(--text-secondary)]",
  SECESSION: "bg-[color-mix(in_srgb,var(--text-muted)_16%,transparent)] text-[var(--text-secondary)]",
};

// Legacy rule labels (backward compatibility)
export const RULE_LABELS: Record<string, string> = {
  free: "무제한",
  once: "1회",
  blocked: "제한",
};

// New access mode labels
export const ACCESS_MODE_LABELS: Record<string, string> = {
  FREE_REVIEW: "복습",
  PROCTORED_CLASS: "온라인 수업 대체",
  BLOCKED: "제한",
};

// Combined labels (access_mode takes precedence)
export const getAccessLabel = (accessMode?: string, rule?: string): string => {
  if (accessMode && ACCESS_MODE_LABELS[accessMode]) {
    return ACCESS_MODE_LABELS[accessMode];
  }
  if (rule && RULE_LABELS[rule]) {
    return RULE_LABELS[rule];
  }
  return "미정";
};

/**
 * ✅ RULE_COLORS도 Tailwind 고정 → theme var 기반 (더 고급스러운 톤)
 * - 텍스트는 on-* 계열 변수가 없다면 white로 유지
 */
export const RULE_COLORS: Record<string, string> = {
  free: "bg-[color-mix(in_srgb,var(--color-primary)_85%,black)]",
  once: "bg-yellow-400 text-black",
  blocked: "bg-[color-mix(in_srgb,var(--color-danger)_85%,black)]",
};

// New access mode colors
export const ACCESS_MODE_COLORS: Record<string, string> = {
  FREE_REVIEW: "bg-[color-mix(in_srgb,var(--color-primary)_85%,black)]",
  PROCTORED_CLASS: "bg-yellow-400 text-black",
  BLOCKED: "bg-[color-mix(in_srgb,var(--color-danger)_85%,black)]",
};

// Combined colors (access_mode takes precedence)
export const getAccessColor = (accessMode?: string, rule?: string): string => {
  if (accessMode && ACCESS_MODE_COLORS[accessMode]) {
    return ACCESS_MODE_COLORS[accessMode];
  }
  if (rule && RULE_COLORS[rule]) {
    return RULE_COLORS[rule];
  }
  return "bg-gray-500";
};
