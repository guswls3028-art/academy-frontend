// PATH: src/shared/tenant/tenants/index.ts
/**
 * 테넌트 레지스트리 SSOT — 5개 테넌트 정의 집계
 * 추가/분리 시 이 디렉터리 내 파일만 수정.
 */
import type { TenantId, TenantBranding, TenantDef } from "./types";
import { hakwonplus } from "./hakwonplus";
import { tchul } from "./tchul";
import { limglish } from "./limglish";
import { ymath } from "./ymath";
import { local } from "./local";

export type { TenantId, TenantBranding, TenantDef };

export const TENANTS: readonly TenantDef[] = [
  hakwonplus,
  tchul,
  limglish,
  ymath,
  local,
] as const;

function buildMaps() {
  const hostToId: Record<string, TenantId> = {};
  const codeToId: Record<string, TenantId> = {};
  const hostnameToCode: Record<string, string> = {};
  const idToBranding: Record<TenantId, TenantBranding> = {} as Record<TenantId, TenantBranding>;

  for (const t of TENANTS) {
    codeToId[t.code] = t.id;
    codeToId[t.code.toLowerCase()] = t.id;
    idToBranding[t.id] = t.branding;
    for (const h of t.hostnames) {
      hostToId[h] = t.id;
      hostToId[h.toLowerCase()] = t.id;
      hostnameToCode[h] = t.code;
      hostnameToCode[h.toLowerCase()] = t.code;
    }
  }

  return { hostToId, codeToId, hostnameToCode, idToBranding };
}

const { hostToId, codeToId, hostnameToCode, idToBranding } = buildMaps();

export const HOST_TO_ID = hostToId;
export const CODE_TO_ID = codeToId;
/** 호스트명 → 백엔드 테넌트 코드 (X-Tenant-Code 헤더용). 로컬 개발용 9999 포함. */
export const HOSTNAME_TO_TENANT_CODE = hostnameToCode;
export const ID_TO_BRANDING = idToBranding;

export function getTenantIdFromCode(code: string): TenantId | null {
  const normalized = String(code ?? "").trim().toLowerCase();
  return (hostToId[normalized] ?? codeToId[normalized]) ?? null;
}

export function getTenantBranding(id: TenantId): TenantBranding {
  return idToBranding[id];
}

/** 로그인 리다이렉트용: tenantId → loginPath */
export function getLoginPathForTenantId(id: TenantId): string {
  const t = TENANTS.find((x) => x.id === id);
  return t?.loginPath ?? "/login/hakwonplus";
}

/** 전용 로그인 페이지를 쓰는 테넌트 ID 목록 (예: tchul) */
export function getTenantIdsWithDedicatedLogin(): readonly TenantId[] {
  return TENANTS.filter((t) => t.dedicatedLoginPage).map((t) => t.id);
}
