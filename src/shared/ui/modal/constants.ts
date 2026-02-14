// PATH: src/shared/ui/modal/constants.ts
// 모달 SSOT — 공통 상수 (width 기본값, 테마 구분 등). 모든 Admin 모달은 여기서 import.

/** Admin 모달 기본 너비 (px) */
export const MODAL_DEFAULT_WIDTH = 520;

/** Admin 모달 타입별 권장 너비 (필요 시 사용) */
export const MODAL_WIDTH = {
  sm: 400,
  md: 560,
  default: MODAL_DEFAULT_WIDTH,
  form: 620,
  wide: 720,
  xwide: 820,
  enroll: 920,
  board: 980,
  full: 1000,
} as const;

/** 라이트/브랜드 테마에서 모달 배경 흰색 처리 (AdminModal 내부용) */
export const BRAND_AND_LIGHT_THEMES = new Set([
  "modern-white",
  "navy-pro",
  "ivory-office",
  "minimal-mono",
  "kakao-business",
  "naver-works",
  "samsung-admin",
  "purple-insight",
]);
