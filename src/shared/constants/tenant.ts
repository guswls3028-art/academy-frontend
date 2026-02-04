// PATH: src/shared/constants/tenant.ts
export type TenantCode = "default" | "2_limglish";

export function resolveTenantCode(): TenantCode {
  const host = window.location.hostname;

  if (host === "limglish.kr" || host === "www.limglish.kr") {
    return "2_limglish";
  }

  return "default";
}
