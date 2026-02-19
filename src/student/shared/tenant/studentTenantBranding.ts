/**
 * 학생앱 전용 테넌트 브랜딩 SSOT
 * - 레이아웃(로고, 타이틀)은 여기서만 참조. 테넌트 추가 시 이 파일과 theme/tenants/{code}.css 만 수정.
 */
import { getTenantIdFromCode, getTenantBranding } from "@/shared/tenant";

// tchul 전용 로고 (배경 제거 아이콘 버전 - SVG 컴포넌트 사용)

export type StudentTenantBranding = {
  /** 로고 이미지 URL (없으면 상단바에서 텍스트 배지 사용) */
  logoUrl: string | null;
  /** 상단바·앱 타이틀 (예: 학원플러스, 박철과학) */
  title: string;
};

/** 2번(tchul) 테넌트 디자인. 9999는 로컬 개발용으로 2번과 동일한 로고·타이틀 사용 */
const TCHUL_DESIGN_CODES = ["tchul", "9999"] as const;

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

  if (TCHUL_DESIGN_CODES.includes(normalized as (typeof TCHUL_DESIGN_CODES)[number])) {
    // tchul 테넌트는 헤더에서 SVG 컴포넌트 직접 사용 (logoUrl은 null)
    return { ...base, logoUrl: null, title: "박철과학" };
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
