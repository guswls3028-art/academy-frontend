// PATH: src/app_admin/domains/tools/stopwatch/pages/StopwatchPage.tsx
// 타이머/스톱워치 도구 페이지 — 모드 전환, 프로젝터/전체화면 상태 공유, ZIP 다운로드
// 선생님이 직접 다운로드하도록 카드 UI로 명확하게 안내 (제목/설명/크기/실행 방법)

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
import styles from "./StopwatchPage.module.css";

type Mode = "timer" | "stopwatch";

export default function StopwatchPage() {
  const [mode, setMode] = useState<Mode>("timer");
  const [projector, setProjector] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [downloading, setDownloading] = useState(false);
  // 첫 방문이면 가이드 펼침, 한 번이라도 다운로드한 적 있으면 접힘 (타이머 영역 확보)
  const [helpOpen, setHelpOpen] = useState(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem("pcTimerDownloaded") !== "1";
  });

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

  const handleDownloadZip = useCallback(async () => {
    setDownloading(true);
    try {
      const { download_url, filename } = await fetchTimerDownloadUrl();
      const a = document.createElement("a");
      a.href = download_url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      try { localStorage.setItem("pcTimerDownloaded", "1"); } catch {}
      feedback.success("다운로드가 시작되었습니다. 압축 파일을 풀고 실행하세요.");
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 404) {
        feedback.error("이 학원에 대한 타이머 프로그램이 아직 준비되지 않았습니다. 관리자에게 문의해주세요.");
      } else {
        feedback.error("다운로드에 실패했습니다. 잠시 후 다시 시도하거나 관리자에게 문의해주세요.");
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
        height: helpOpen ? "calc(100vh - 440px)" : "calc(100vh - 340px)",
        minHeight: 440,
      };

  return (
    <div style={{ position: "relative" }}>
      {/* PC 다운로드 카드 — 타이머 영역 밖 상단. 전체화면 시 숨김. */}
      {!isFullscreen && (
        <section className={styles.downloadCard} aria-labelledby="pc-timer-download-title">
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
              <h3 id="pc-timer-download-title" className={styles.cardTitle}>
                PC 전용 타이머 프로그램
              </h3>
              <p className={styles.cardDesc}>
                인터넷 없이도 사용 가능한 Windows 전용 프로그램입니다. 수업 중 브라우저 오류·인터넷 끊김 걱정 없이 안정적으로 쓸 수 있습니다.
              </p>
              <span className={styles.cardMeta}>
                <span>Windows 10 / 11</span>
                <span className={styles.metaDot} aria-hidden />
                <span>ZIP 압축 파일</span>
              </span>
            </div>
          </div>

          <div className={styles.cardRight}>
            <button
              className={styles.downloadBtn}
              onClick={handleDownloadZip}
              disabled={downloading}
              aria-busy={downloading}
              type="button"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              <span>{downloading ? "다운로드 중..." : "Windows용 다운로드"}</span>
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
              <p className={styles.helpTitle}>다운로드 후 실행하는 법</p>
              <ol className={styles.helpSteps}>
                <li>다운로드된 ZIP 파일을 <b>우클릭 → "압축 풀기"</b>(또는 "모두 추출") 합니다.</li>
                <li>압축이 풀린 폴더 안의 <b>Timer</b> 파일을 더블클릭하여 실행합니다.</li>
                <li>바탕화면에 바로 가기를 만들어 두면 다음부터 한 번에 실행할 수 있습니다.</li>
              </ol>

              <div className={styles.helpWarning}>
                <div className={styles.warnHeader}>
                  <span className={styles.warnIcon} aria-hidden>⚠</span>
                  <strong>"Windows에서 PC를 보호했습니다" 경고가 뜨면 (정상입니다)</strong>
                </div>
                <p className={styles.warnDesc}>
                  학원 자체 제작 프로그램이라 Microsoft에 등록되어 있지 않을 뿐, 안전한 프로그램입니다. 아래 두 단계만 누르면 정상 실행됩니다.
                </p>
                <ol className={styles.warnSteps}>
                  <li>
                    <span className={styles.stepBadge}>1</span>
                    경고창의 <b>"추가 정보"</b> 글씨 클릭
                  </li>
                  <li>
                    <span className={styles.stepBadge}>2</span>
                    아래쪽에 나타나는 <b>"실행"</b> 버튼 클릭
                  </li>
                </ol>
                <p className={styles.warnNote}>
                  ※ 첫 실행 1번만 나타납니다. 이후에는 바로 실행됩니다.
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
