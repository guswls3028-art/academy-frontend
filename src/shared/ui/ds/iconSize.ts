// PATH: src/shared/ui/ds/iconSize.ts
//
// 아이콘 크기 SSOT — lucide-react / antd icon에 px 직접 박지 말고 이 토큰만 사용.
// CSS 토큰(--icon-xs ~ --icon-xl)과 1:1 동기. 변경 시 양쪽 모두 수정.
//
// 컨텍스트 기준 (CLAUDE 규약):
//   xs (12) : matrix cell / dense list / 1ch badge 안
//   sm (14) : 인라인 라벨 / button-sm / badge-md (가장 흔한 기본값)
//   md (16) : button-md / table action / 일반 헤더
//   lg (20) : kpi / card 메타 강조
//   xl (24) : 대표 액션 / 로고 옆 강조
//
// 사용:
//   import { ICON } from "@/shared/ui/ds/iconSize";
//   <Search size={ICON.sm} />
//   <Plus size={ICON.md} />

export const ICON = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 20,
  xl: 24,
} as const;

export type IconSizeKey = keyof typeof ICON;

/** 뱃지 사이즈와 1:1 매칭되는 권장 아이콘 크기 */
export const ICON_FOR_BADGE: Record<"xs" | "sm" | "md" | "lg", number> = {
  xs: ICON.xs,
  sm: ICON.xs,
  md: ICON.sm,
  lg: ICON.sm,
};

/** 버튼 사이즈와 1:1 매칭되는 권장 아이콘 크기 */
export const ICON_FOR_BUTTON: Record<"sm" | "md" | "lg" | "xl", number> = {
  sm: ICON.sm,
  md: ICON.md,
  lg: ICON.md,
  xl: ICON.lg,
};
