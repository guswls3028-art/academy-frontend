/**
 * 학생앱 전용 테넌트 브랜딩 SSOT
 * - 레이아웃(로고, 타이틀)은 여기서만 참조. 테넌트 추가 시 이 파일과 theme/tenants/{code}.css 만 수정.
 */
import {
  getTenantIdFromCode,
  getTenantBranding,
  type TenantId,
} from "@/shared/tenant";

// tchul 전용 로고 (auth SSOT와 동일 에셋)
import TchulLogoTransparent from "@/features/auth/pages/logos/TchulLogoTransparent.png";

export type StudentTenantBranding = {
  /** 로고 이미지 URL (없으면 상단바에서 텍스트 배지 사용) */
  logoUrl: string | null;
  /** 상단바·앱 타이틀 (예: 학원플러스, 박철과학) */
  title: string;
};

const TENANT_CODE = "tchul" as const;

/**
 * 학생앱에서 사용할 테넌트별 브랜딩.
 * 테넌트 추가 시 여기에 code → { logoUrl?, title } 매핑 추가.
 */
function getStudentBrandingByCode(code: string | null): StudentTenantBranding {
  if (!code) {
    return { logoUrl: null, title: "학원플러스" };
  }
  const normalized = code.trim().toLowerCase();
  const tenantId = getTenantIdFromCode(normalized);
  const fallback: StudentTenantBranding = { logoUrl: null, title: "학원플러스" };
  if (!tenantId) return fallback;

  const branding = getTenantBranding(tenantId);
  const base = { title: branding.loginTitle || fallback.title };

  if (normalized === TENANT_CODE) {
    return { ...base, logoUrl: TchulLogoTransparent };
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
