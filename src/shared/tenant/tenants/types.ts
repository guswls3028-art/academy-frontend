// PATH: src/shared/tenant/tenants/types.ts
/** 테넌트 ID (1=학원플러스, 2=tchul, 3=limglish, 4=ymath, 9999=로컬개발) */
export type TenantId = 1 | 2 | 3 | 4 | 9999;

export type TenantBranding = {
  loginTitle: string;
  loginSubtitle?: string;
  logoUrl?: string;
};

/** 단일 테넌트 정의 — tenants/*.ts 에서 사용 */
export type TenantDef = {
  id: TenantId;
  code: string;
  name: string;
  hostnames: string[];
  loginPath: string;
  branding: TenantBranding;
  /** 전용 로그인 페이지 사용 여부 (예: tchul 2컬럼 브랜드 페이지) */
  dedicatedLoginPage: boolean;
};
