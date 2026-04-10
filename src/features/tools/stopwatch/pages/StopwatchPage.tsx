// PATH: src/features/tools/stopwatch/pages/StopwatchPage.tsx
// 타이머/스톱워치 도구 페이지 — 모드 전환, 프로젝터/전체화면 상태 공유
// wrapper div가 fullscreen 대상 → 모드 전환 시에도 전체화면 유지

import { useMemo, useState, useRef, useEffect } from "react";
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
  const wrapperRef = useRef<HTMLDivElement>(null);

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

  // Track fullscreen state on wrapper
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
    containerRef: wrapperRef,
  };

  return (
    <div
      ref={wrapperRef}
      style={{
        height: isFullscreen ? "100vh" : "calc(100vh - 180px)",
        minHeight: 500,
        background: isFullscreen ? (projector ? "#000" : "#f8f9fb") : undefined,
      }}
    >
      {mode === "timer" ? (
        <TimerCore {...shared} />
      ) : (
        <StopwatchCore {...shared} />
      )}
    </div>
  );
}
