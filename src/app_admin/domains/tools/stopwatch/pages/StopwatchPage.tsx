// PATH: src/app_admin/domains/tools/stopwatch/pages/StopwatchPage.tsx
// 타이머/스톱워치 도구 페이지 — 모드 전환, 프로젝터/전체화면 상태 공유, exe 다운로드
// document.documentElement fullscreen → wrapper가 화면 전체를 덮음

import { useMemo, useState, useEffect, useCallback } from "react";
import {
  resolveTenantCode,
  getTenantIdFromCode,
  getTenantBranding,
  getTenantDefById,
} from "@/shared/tenant";
import { feedback } from "@/shared/ui/feedback/feedback";
import TimerCore from "../components/TimerCore";
import StopwatchCore from "../components/StopwatchCore";
import { fetchTimerDownloadUrl } from "../api/timer.api";

type Mode = "timer" | "stopwatch";

export default function StopwatchPage() {
  const [mode, setMode] = useState<Mode>("timer");
  const [projector, setProjector] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [downloading, setDownloading] = useState(false);

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

  const handleDownloadExe = useCallback(async () => {
    setDownloading(true);
    try {
      const { download_url, filename } = await fetchTimerDownloadUrl();
      const a = document.createElement("a");
      a.href = download_url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 404) {
        feedback.error("이 학원에 대한 타이머 프로그램이 아직 준비되지 않았습니다.");
      } else {
        feedback.error("다운로드에 실패했습니다. 잠시 후 다시 시도해주세요.");
      }
    } finally {
      setDownloading(false);
    }
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
    <div style={{ position: "relative" }}>
      {/* 다운로드 버튼 — 타이머 영역 밖 상단 우측 */}
      {!isFullscreen && (
        <div style={{
          display: "flex",
          justifyContent: "flex-end",
          padding: "0 0 8px",
        }}>
          <button
            onClick={handleDownloadExe}
            disabled={downloading}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "7px 14px",
              fontSize: 13,
              fontWeight: 500,
              color: "#495057",
              background: "#fff",
              border: "1px solid #dee2e6",
              borderRadius: 8,
              cursor: downloading ? "wait" : "pointer",
              opacity: downloading ? 0.6 : 1,
              transition: "all 0.15s",
            }}
            onMouseEnter={(e) => {
              if (!downloading) {
                e.currentTarget.style.borderColor = "#3b5bdb";
                e.currentTarget.style.color = "#3b5bdb";
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "#dee2e6";
              e.currentTarget.style.color = "#495057";
            }}
            type="button"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            {downloading ? "다운로드 중..." : "PC 프로그램 다운로드"}
          </button>
        </div>
      )}

      <div style={wrapperStyle}>
        {mode === "timer" ? (
          <TimerCore {...shared} />
        ) : (
          <StopwatchCore {...shared} />
        )}
      </div>
    </div>
  );
}
