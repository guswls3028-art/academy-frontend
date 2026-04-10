// PATH: src/features/tools/stopwatch/pages/StopwatchPage.tsx
// 타이머/스톱워치 도구 페이지 — 모드 전환, 프로젝터/전체화면 상태 공유
// document.documentElement fullscreen → wrapper가 화면 전체를 덮음

import { useMemo, useState, useEffect } from "react";
import {
  resolveTenantCode,
  getTenantIdFromCode,
  getTenantBranding,
  getTenantDefById,
} from "@/shared/tenant";
import TimerCore from "../components/TimerCore";
import StopwatchCore from "../components/StopwatchCore";

type Mode = "timer" | "stopwatch";

export default function StopwatchPage() {
  const [mode, setMode] = useState<Mode>("timer");
  const [projector, setProjector] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

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

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  const shared = {
    logoUrl,
    academyName,
    mode,
    onModeChange: setMode,
    projector,
    onProjectorChange: setProjector,
  };

  // fullscreen일 때: fixed overlay로 전체 화면 덮기 (사이드바/헤더 위)
  const wrapperStyle: React.CSSProperties = isFullscreen
    ? {
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: projector ? "#000" : "#f8f9fb",
      }
    : {
        height: "calc(100vh - 180px)",
        minHeight: 500,
      };

  return (
    <div style={wrapperStyle}>
      {mode === "timer" ? (
        <TimerCore {...shared} />
      ) : (
        <StopwatchCore {...shared} />
      )}
    </div>
  );
}
