// PATH: src/shared/hooks/useFavicon.tsx
// Favicon + OG 메타 동적 설정 Hook — 테넌트별 favicon·og:image를 런타임에 적용

import { useEffect } from "react";
import { resolveTenantCode, getTenantIdFromCode, getTenantBranding } from "@/shared/tenant";

function setMetaContent(selector: string, value: string) {
  let el = document.querySelector<HTMLMetaElement>(selector);
  if (!el) {
    el = document.createElement("meta");
    const prop = selector.match(/property="([^"]+)"/)?.[1];
    const name = selector.match(/name="([^"]+)"/)?.[1];
    if (prop) el.setAttribute("property", prop);
    if (name) el.setAttribute("name", name);
    document.head.appendChild(el);
  }
  el.setAttribute("content", value);
}

/**
 * 테넌트에 따라 favicon과 og:image를 동적으로 설정합니다.
 * TenantBranding.faviconUrl → favicon, ogImageUrl → og:image + twitter:image
 */
export function useFavicon() {
  useEffect(() => {
    const tenantResult = resolveTenantCode();
    if (!tenantResult.ok) return;

    const tenantId = getTenantIdFromCode(tenantResult.code);
    if (!tenantId) return;

    const branding = getTenantBranding(tenantId);

    // Favicon
    if (branding.faviconUrl) {
      const link =
        document.querySelector<HTMLLinkElement>('link[rel="icon"]') ??
        document.createElement("link");
      link.rel = "icon";
      link.type = "image/png";
      link.href = branding.faviconUrl;
      if (!link.parentNode) {
        document.head.appendChild(link);
      }
    }

    // OG image (카카오톡/페이스북/트위터 링크 미리보기)
    if (branding.ogImageUrl) {
      const imgUrl = window.location.origin + branding.ogImageUrl;
      setMetaContent('meta[property="og:image"]', imgUrl);
      setMetaContent('meta[name="twitter:image"]', imgUrl);
    }

    // OG description
    if (branding.ogDescription) {
      setMetaContent('meta[property="og:description"]', branding.ogDescription);
      setMetaContent('meta[name="twitter:description"]', branding.ogDescription);
    }
  }, []);
}
