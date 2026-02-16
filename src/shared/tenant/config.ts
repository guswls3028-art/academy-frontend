// PATH: src/shared/tenant/config.ts
/**
 * 멀티테넌트 ID·브랜딩 SSOT (학원쎔 3+1)
 * - hakwonplus.com = 1 (메인)
 * - tchul.com = 2, limglish.kr = 3, ymath.co.kr = 4
 */

export type TenantId = 1 | 2 | 3 | 4 | 9999;

const HOST_TO_ID: Record<string, TenantId> = {
  "hakwonplus.com": 1,
  "www.hakwonplus.com": 1,
  "tchul.com": 2,
  "www.tchul.com": 2,
  "limglish.kr": 3,
  "www.limglish.kr": 3,
  "ymath.co.kr": 4,
  "www.ymath.co.kr": 4,
  localhost: 9999,
  "127.0.0.1": 9999,
};

/** 테넌트 코드 → TenantId (호스트 없이 tenantCode만 올 때 사용) */
const CODE_TO_ID: Record<string, TenantId> = {
  hakwonplus: 1,
  tchul: 2,
  limglish: 3,
  ymath: 4,
  "9999": 9999,
};

/** 호스트명 → 백엔드 테넌트 코드 (X-Tenant-Code 헤더용 SSOT). 로컬 개발용 9999 포함. */
export const HOSTNAME_TO_TENANT_CODE: Record<string, string> = {
  "hakwonplus.com": "hakwonplus",
  "www.hakwonplus.com": "hakwonplus",
  "tchul.com": "tchul",
  "www.tchul.com": "tchul",
  "limglish.kr": "limglish",
  "www.limglish.kr": "limglish",
  "ymath.co.kr": "ymath",
  "www.ymath.co.kr": "ymath",
  localhost: "9999",
  "127.0.0.1": "9999",
};

export type TenantBranding = {
  loginTitle: string;
  loginSubtitle?: string;
  logoUrl?: string;
};

const ID_TO_BRANDING: Record<TenantId, TenantBranding> = {
  1: { loginTitle: "HakwonPlus 관리자 로그인", loginSubtitle: undefined, logoUrl: undefined },
  2: { loginTitle: "tchul.com 로그인", loginSubtitle: undefined, logoUrl: undefined },
  3: { loginTitle: "limglish 로그인", loginSubtitle: undefined, logoUrl: undefined },
  4: { loginTitle: "ymath 로그인", loginSubtitle: undefined, logoUrl: undefined },
  9999: { loginTitle: "로컬 개발 (9999)", loginSubtitle: undefined, logoUrl: undefined },
};

/**
 * 테넌트 코드(호스트명 또는 tenant code) → 테넌트 ID. 없으면 null.
 */
export function getTenantIdFromCode(code: string): TenantId | null {
  const normalized = String(code || "").trim().toLowerCase();
  return (HOST_TO_ID[normalized] as TenantId) ?? (CODE_TO_ID[normalized] as TenantId) ?? null;
}

/**
 * 테넌트 ID → 정적 브랜딩(로고/타이틀). API ui_config 없을 때 폴백.
 */
export function getTenantBranding(id: TenantId): TenantBranding {
  return ID_TO_BRANDING[id];
}
