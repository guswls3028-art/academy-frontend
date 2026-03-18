/**
 * 학생앱 전용 테넌트 브랜딩 SSOT
 * - 레이아웃(로고, 타이틀)은 여기서만 참조. 테넌트 추가 시 이 파일과 theme/tenants/{code}.css 만 수정.
 */
import { getTenantIdFromCode, getTenantBranding } from "@/shared/tenant";

export type StudentTenantBranding = {
  /** 로고 이미지 URL (없으면 상단바에서 텍스트 배지 사용) */
  logoUrl: string | null;
  /** 상단바·앱 타이틀 (예: 학원플러스, 박철과학) */
  title: string;
  /** commonlogo 사용 여부 (StudentTopBar에서 CommonLogo 직접 참조) */
  useCommonLogo?: boolean;
};

/** 2번(박철과학) 전용 — TchulLogoIcon 사용 */
const TCHUL_DESIGN_CODES = ["tchul"] as const;
/** 1,3,4,9999 공통 — commonlogo 사용 (common=9999 로컬 경로) */
const COMMON_LOGO_CODES = ["hakwonplus", "limglish", "ymath", "dnb", "9999", "common"] as const;

/**
 * 학생앱에서 사용할 테넌트별 브랜딩.
 * 테넌트 추가 시 여기에 code → { logoUrl?, title } 매핑 추가.
 */
function getStudentBrandingByCode(code: string | null): StudentTenantBranding {
  if (!code) {
    return { logoUrl: null, title: "학원플러스" };
  }
  const normalized = code.trim().toLowerCase();
  // /login/common 경로 → 9999와 동일 브랜딩
  const effectiveCode = normalized === "common" ? "9999" : normalized;
  const tenantId = getTenantIdFromCode(effectiveCode);
  const fallback: StudentTenantBranding = { logoUrl: null, title: "학원플러스" };
  if (!tenantId) return fallback;

  const branding = getTenantBranding(tenantId);
  const base = { title: branding.loginTitle || fallback.title };
  if (normalized === "common") {
    return { ...base, logoUrl: null, useCommonLogo: true };
  }

  if (TCHUL_DESIGN_CODES.includes(effectiveCode as (typeof TCHUL_DESIGN_CODES)[number])) {
    return { ...base, logoUrl: null };
  }

  if (COMMON_LOGO_CODES.includes(effectiveCode as (typeof COMMON_LOGO_CODES)[number])) {
    return { ...base, logoUrl: null, useCommonLogo: true };
  }

  return { ...base, logoUrl: branding.logoUrl ?? null };
}

/**
 * 현재 테넌트 코드에 대한 학생앱 브랜딩 (로고·타이틀).
 * StudentLayout / StudentTopBar 에서 사용.
 */
export function getStudentTenantBranding(tenantCode: string | null): StudentTenantBranding {
  return getStudentBrandingByCode(tenantCode);
}
