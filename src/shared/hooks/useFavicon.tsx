// PATH: src/shared/hooks/useFavicon.tsx
// Favicon 동적 설정 Hook — 테넌트별 favicon을 런타임에 적용

import { useEffect } from "react";
import { resolveTenantCode, getTenantIdFromCode, getTenantBranding } from "@/shared/tenant";

/**
 * 테넌트에 따라 favicon을 동적으로 설정합니다.
 * TenantBranding.faviconUrl이 있으면 해당 URL로 교체, 없으면 기본 유지.
 */
export function useFavicon() {
  useEffect(() => {
    const tenantResult = resolveTenantCode();
    if (!tenantResult.ok) return;

    const tenantId = getTenantIdFromCode(tenantResult.code);
    if (!tenantId) return;

    const branding = getTenantBranding(tenantId);
    if (!branding.faviconUrl) return;

    const link =
      document.querySelector<HTMLLinkElement>('link[rel="icon"]') ??
      document.createElement("link");
    link.rel = "icon";
    link.type = "image/png";
    link.href = branding.faviconUrl;
    if (!link.parentNode) {
      document.head.appendChild(link);
    }
  }, []);
}
