const PRODUCTION_API_HOST = "api.hakwonplus.com";

export const PRODUCTION_CONTROLLED_PHONE = "01031217466";

export function normalizeE2EPhone(value: unknown): string {
  return String(value ?? "").replace(/\D/g, "");
}

export function isProductionApiUrl(
  apiUrl = process.env.E2E_API_URL || "https://api.hakwonplus.com",
): boolean {
  try {
    return new URL(apiUrl).hostname.toLowerCase() === PRODUCTION_API_HOST;
  } catch {
    return false;
  }
}

/**
 * Production recipients are deliberately not configurable. Environment
 * overrides are useful for isolated local providers only.
 */
export function controlledPhoneForApiUrl(
  apiUrl: string,
  configuredPhone = process.env.E2E_REAL_ALIMTALK_CONTROLLED_PHONE,
): string {
  if (isProductionApiUrl(apiUrl)) return PRODUCTION_CONTROLLED_PHONE;
  return normalizeE2EPhone(configuredPhone) || PRODUCTION_CONTROLLED_PHONE;
}

export function realMessagingSkipReason(
  apiUrl: string,
  configuredPhone: string,
  optInValue = process.env.E2E_ALLOW_REAL_ALIMTALK,
): string | null {
  if (String(optInValue ?? "").trim() !== "1") {
    return "실제 알림톡 발송은 E2E_ALLOW_REAL_ALIMTALK=1 명시 실행에서만 허용됩니다.";
  }
  if (
    isProductionApiUrl(apiUrl) &&
    normalizeE2EPhone(configuredPhone) !== PRODUCTION_CONTROLLED_PHONE
  ) {
    return `운영 실발송 수신자는 ${PRODUCTION_CONTROLLED_PHONE} 한 곳만 허용됩니다.`;
  }
  return null;
}

export function productionTriggerMutationSkipReason(apiUrl: string): string | null {
  if (!isProductionApiUrl(apiUrl)) return null;
  return "운영 기존 레코드를 바꾸는 트리거 E2E는 금지됩니다. 격리된 비운영 API에서 실행하세요.";
}

export function productionUnisolatedScenarioSkipReason(apiUrl: string): string | null {
  if (!isProductionApiUrl(apiUrl)) return null;
  return "소유 ID cleanup이 보장되지 않는 시나리오 E2E는 운영 API에서 실행할 수 없습니다.";
}

export function productionMultiNoticeFlowSkipReason(apiUrl: string): string | null {
  if (!isProductionApiUrl(apiUrl)) return null;
  return "다중 계정 안내 발송 flow는 운영에서 금지됩니다. 격리 API의 계약 테스트로 실행하세요.";
}

export function nonPrimaryTenantWriteSkipReason(
  tenantCode: string,
  apiUrl: string,
): string | null {
  const normalizedTenant = tenantCode.trim().toLowerCase();
  if (["hakwonplus", "9999"].includes(normalizedTenant)) return null;
  if (!isProductionApiUrl(apiUrl)) return null;
  return `운영 ${normalizedTenant} 테넌트 쓰기 E2E는 금지됩니다. Tenant 1/9999 또는 격리 환경을 사용하세요.`;
}
