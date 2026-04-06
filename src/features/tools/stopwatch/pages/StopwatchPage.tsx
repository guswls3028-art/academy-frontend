// PATH: src/features/tools/stopwatch/pages/StopwatchPage.tsx
// 스톱워치 도구 페이지 — 테넌트 로고 자동 적용, 전체화면 + 다운로드 지원

import { useMemo } from "react";
import {
  resolveTenantCode,
  getTenantIdFromCode,
  getTenantBranding,
  getTenantDefById,
} from "@/shared/tenant";
import StopwatchCore from "../components/StopwatchCore";

export default function StopwatchPage() {
  const { logoUrl, academyName } = useMemo(() => {
    const result = resolveTenantCode();
    if (!result.ok) return { logoUrl: undefined, academyName: undefined };
    const tenantId = getTenantIdFromCode(result.code);
    if (!tenantId) return { logoUrl: undefined, academyName: undefined };
    const branding = getTenantBranding(tenantId);
    const def = getTenantDefById(tenantId);
    return {
      logoUrl: branding?.logoUrl ?? undefined,
      academyName: branding?.loginTitle ?? def?.name ?? undefined,
    };
  }, []);

  return (
    <div style={{ height: "calc(100vh - 180px)", minHeight: 500 }}>
      <StopwatchCore logoUrl={logoUrl} academyName={academyName} />
    </div>
  );
}
