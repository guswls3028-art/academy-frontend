// PATH: src/shared/tenant/config.ts
/**
 * 멀티테넌트 ID·브랜딩 SSOT — tenants/ 레지스트리에서 파생
 * 1=학원플러스, 2=tchul, 3=limglish, 4=ymath, 9999=로컬개발
 */
export {
  getTenantIdFromCode,
  getTenantBranding,
  HOSTNAME_TO_TENANT_CODE,
  getLoginPathForTenantId,
  getTenantIdsWithDedicatedLogin,
  TENANTS,
} from "./tenants";
export type { TenantId, TenantBranding } from "./tenants";
