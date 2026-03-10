// PATH: src/shared/hooks/useFavicon.tsx
// Favicon 동적 설정 Hook

import { useEffect } from "react";
import { resolveTenantCode } from "@/shared/tenant";

/**
 * 테넌트에 따라 favicon을 동적으로 설정합니다.
 * tchul: 로고 PNG 없음 — 기본 favicon 유지. 추후 에셋 추가 시 설정 가능.
 */
export function useFavicon() {
  useEffect(() => {
    const tenantResult = resolveTenantCode();
    if (!tenantResult.ok) return;
    // tchul 전용 favicon 에셋 없음 — 기본 favicon 유지
  }, []);
}
