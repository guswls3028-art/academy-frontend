// PATH: src/shared/hooks/useFavicon.tsx
// Favicon 동적 설정 Hook

import { useEffect } from "react";
import { resolveTenantCode } from "@/shared/tenant";
import { getTenantIdFromCode } from "@/shared/tenant";
import TchulLogoIcon from "@/features/auth/pages/logos/TchulLogoIcon.png";

/**
 * 테넌트에 따라 favicon을 동적으로 설정합니다.
 * tchul.com 테넌트일 경우 Tchul 로고를 favicon으로 사용합니다.
 */
export function useFavicon() {
  useEffect(() => {
    const tenantResult = resolveTenantCode();
    if (!tenantResult.ok) return;

    const tenantId = getTenantIdFromCode(tenantResult.code);
    
    // tchul 테넌트 (2번 또는 9999 로컬)인 경우
    const isTchul = tenantResult.code === "tchul" || tenantResult.code === "9999" || tenantId === 2;
    
    if (isTchul) {
      // 기존 favicon 링크 찾기 또는 생성
      let faviconLink = document.querySelector("link[rel='icon']") as HTMLLinkElement;
      
      if (!faviconLink) {
        faviconLink = document.createElement("link");
        faviconLink.rel = "icon";
        document.head.appendChild(faviconLink);
      }
      
      // Tchul 로고를 favicon으로 설정 (배경 제거 아이콘 버전)
      faviconLink.href = TchulLogoIcon;
      faviconLink.type = "image/png";
    }
  }, []);
}
