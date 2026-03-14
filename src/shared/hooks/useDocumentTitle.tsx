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

    // 1) Program의 ui_config.window_title (DB에서 명시적으로 설정한 값)
    const windowTitle = program?.ui_config?.window_title;
    if (windowTitle) {
      document.title = windowTitle;
      return;
    }

    // 2) Tenant branding windowTitle (프론트 코드에 정의된 테넌트별 값)
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

    // 3) Program display_name (마지막 fallback)
    const displayName = program?.display_name;
    if (displayName) {
      document.title = displayName;
      return;
    }

    // 4) 기본값
    document.title = "학원플러스";
  }, [title, program]);
}
