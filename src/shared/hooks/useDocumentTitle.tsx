// PATH: src/shared/hooks/useDocumentTitle.tsx
// 브라우저 타이틀 동적 설정 Hook — program > tenant branding > 기본값 순서

import { useEffect } from "react";
import { useProgram } from "@/shared/program";
import { resolveTenantCode, getTenantIdFromCode, getTenantBranding } from "@/shared/tenant";

export function useDocumentTitle(title?: string) {
  const { program } = useProgram();

  useEffect(() => {
    if (title) {
      document.title = title;
      return;
    }

    // 1) Program의 ui_config.window_title
    const windowTitle = program?.ui_config?.window_title;
    if (windowTitle) {
      document.title = windowTitle;
      return;
    }

    // 2) Program display_name
    const displayName = program?.display_name;
    if (displayName) {
      document.title = displayName;
      return;
    }

    // 3) Tenant branding windowTitle
    const tenantResult = resolveTenantCode();
    if (tenantResult.ok) {
      const tenantId = getTenantIdFromCode(tenantResult.code);
      if (tenantId) {
        const branding = getTenantBranding(tenantId);
        if (branding.windowTitle) {
          document.title = branding.windowTitle;
          return;
        }
      }
    }

    // 4) 기본값
    document.title = "HakwonPlus";
  }, [title, program]);
}
