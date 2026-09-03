// PATH: src/app_admin/domains/tools/stopwatch/pages/StopwatchPage.tsx
// 타이머/스톱워치 도구 페이지 — 모드 전환, 프로젝터/전체화면, 안전한 PWA 설치

import { useMemo, useState, useEffect, useCallback } from "react";
import {
  resolveTenantCode,
  getTenantIdFromCode,
  getTenantBranding,
  getTenantDefById,
} from "@/shared/tenant";
import { feedback } from "@/shared/ui/feedback/feedback";
import { useA2HS } from "@/shared/pwa/useA2HS";
import TimerCore from "../components/TimerCore";
import StopwatchCore from "../components/StopwatchCore";
import styles from "./StopwatchPage.module.css";

type Mode = "timer" | "stopwatch";

export default function StopwatchPage() {
  const [mode, setMode] = useState<Mode>("timer");
  const [projector, setProjector] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [helpOpen, setHelpOpen] = useState(true);
  const { canInstall, isInstalled, promptInstall } = useA2HS();

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

  const handleInstall = useCallback(async () => {
    if (!canInstall) {
      setHelpOpen(true);
      return;
    }

    setInstalling(true);
    try {
      if (await promptInstall()) {
        feedback.success("안전한 웹 타이머 앱을 설치했습니다.");
      }
    } finally {
      setInstalling(false);
    }
  }, [canInstall, promptInstall]);

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
        height: helpOpen ? "calc(100vh - 440px)" : "calc(100vh - 340px)",
        minHeight: 440,
      };

  return (
    <div className={styles.page}>
      {/* 안전한 PC 설치 카드 — unsigned EXE/ZIP 대신 PWA만 안내한다. */}
      {!isFullscreen && (
        <section className={styles.downloadCard} aria-labelledby="pc-timer-install-title">
          <div className={styles.cardRow}>
          <div className={styles.cardLeft}>
            <div className={styles.cardIcon} aria-hidden>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="3" width="20" height="14" rx="2" />
                <line x1="8" y1="21" x2="16" y2="21" />
                <line x1="12" y1="17" x2="12" y2="21" />
              </svg>
            </div>
            <div className={styles.cardText}>
              <h3 id="pc-timer-install-title" className={styles.cardTitle}>
                안전한 PC 타이머
              </h3>
              <p className={styles.cardDesc}>
                지금 보고 있는 화면이 공식 타이머입니다. 서명되지 않은 실행 파일 없이도 Windows 앱처럼 설치해 사용할 수 있습니다.
              </p>
              <span className={styles.cardMeta}>
                <span>Windows 10 / 11</span>
                <span className={styles.metaDot} aria-hidden />
                <span>웹/PWA</span>
                <span className={styles.metaDot} aria-hidden />
                <span>현재 학원 HTTPS 주소</span>
              </span>
            </div>
          </div>

          <div className={styles.cardRight}>
            <button
              className={styles.downloadBtn}
              onClick={() => void handleInstall()}
              disabled={installing || isInstalled}
              aria-busy={installing}
              type="button"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              <span>
                {isInstalled
                  ? "앱으로 실행 중"
                  : installing
                    ? "설치 확인 중..."
                    : canInstall
                      ? "이 PC에 앱으로 설치"
                      : "설치 방법 보기"}
              </span>
            </button>
            <button
              className={styles.helpToggle}
              onClick={() => setHelpOpen((v) => !v)}
              type="button"
              aria-expanded={helpOpen}
              aria-controls="pc-timer-help-panel"
            >
              <span>실행 방법 {helpOpen ? "접기" : "보기"}</span>
              <svg
                className={`${styles.helpChevron} ${helpOpen ? styles.helpChevronOpen : ""}`}
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
          </div>
          </div>

          {helpOpen && (
            <div id="pc-timer-help-panel" className={styles.helpPanel}>
              <p className={styles.helpTitle}>Windows에서 안전하게 설치하는 법</p>
              <ol className={styles.helpSteps}>
                <li>Edge 또는 Chrome 주소창의 <b>앱 설치 아이콘</b>을 선택합니다.</li>
                <li>아이콘이 없으면 브라우저 메뉴의 <b>앱 → 이 사이트를 앱으로 설치</b>를 선택합니다.</li>
                <li>설치 후에는 시작 메뉴나 작업 표시줄에서 학원 타이머를 엽니다.</li>
              </ol>

              <div className={styles.helpWarning}>
                <div className={styles.warnHeader}>
                  <span className={styles.warnIcon} aria-hidden>✓</span>
                  <strong>Smart App Control은 켠 상태로 유지하세요</strong>
                </div>
                <p className={styles.warnDesc}>
                  기존 <b>English_Timer (1).exe</b>, <b>English_Timer.exe</b>, <b>Timer.exe</b>는 서명된 새 버전이 아닙니다. 실행하지 말고 삭제한 뒤 이 웹/PWA 타이머를 사용하세요.
                </p>
                <p className={styles.warnNote}>
                  파일을 내려받지 않으므로 같은 이름의 <b>(1)</b> 중복본도 생기지 않습니다.
                </p>
              </div>
            </div>
          )}
        </section>
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
