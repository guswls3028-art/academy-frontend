// PATH: src/shared/hooks/useDocumentTitle.tsx
// 브라우저 타이틀 동적 설정 Hook

import { useEffect } from "react";
import { useProgram } from "@/shared/program";
import { resolveTenantCode } from "@/shared/tenant";
import { getStudentTenantBranding } from "@/student/shared/tenant/studentTenantBranding";

export function useDocumentTitle(title?: string) {
  const { program } = useProgram();

  useEffect(() => {
    // 명시적 title이 있으면 우선 사용
    if (title) {
      document.title = title;
      return;
    }

    // 학생 앱인지 확인 (data-app="student" 체크)
    const isStudentApp = document.querySelector('[data-app="student"]') !== null;
    
    if (isStudentApp) {
      // 학생 앱: 테넌트별 타이틀 설정
      const tenantResult = resolveTenantCode();
      if (tenantResult.ok) {
        const branding = getStudentTenantBranding(tenantResult.code);
        document.title = branding.title;
        return;
      }
      // 기본 학생 앱 타이틀
      document.title = "학원플러스";
      return;
    }

    // 선생/관리자 앱: Program의 ui_config.window_title 또는 display_name 사용
    const windowTitle = program?.ui_config?.window_title;
    const displayName = program?.display_name;
    
    if (windowTitle) {
      document.title = windowTitle;
    } else if (displayName) {
      document.title = displayName;
    } else {
      document.title = "HakwonPlus";
    }
  }, [title, program]);
}
