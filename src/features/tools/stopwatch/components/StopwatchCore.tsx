// PATH: src/features/tools/stopwatch/components/StopwatchCore.tsx
// 프리미엄 스톱워치 — 빔프로젝터 모드 지원, 테넌트 로고 브랜딩

import { useState, useRef, useCallback, useEffect } from "react";
import styles from "./StopwatchCore.module.css";

type Mode = "timer" | "stopwatch";

interface Props {
  /** 학원 로고 URL (없으면 로고 미표시) */
  logoUrl?: string;
  /** 학원명 */
  academyName?: string;
  /** 전체화면 모드에서 시작 */
  startFullscreen?: boolean;
  mode?: Mode;
  onModeChange?: (mode: Mode) => void;
  projector?: boolean;
  onProjectorChange?: (v: boolean) => void;
  containerRef?: React.RefObject<HTMLDivElement | null>;
}

function pad(n: number, d = 2) {
  return String(n).padStart(d, "0");
}

function formatTime(ms: number) {
  const t = Math.floor(ms);
  return {
    h: pad(Math.floor(t / 3600000)),
    m: pad(Math.floor((t % 3600000) / 60000)),
    s: pad(Math.floor((t % 60000) / 1000)),
    cs: pad(Math.floor((t % 1000) / 10)),
  };
}

function formatTimeStr(ms: number) {
  const f = formatTime(ms);
  return `${f.h}:${f.m}:${f.s}.${f.cs}`;
}

type Lap = { n: number; split: number; total: number };

export default function StopwatchCore({ logoUrl, academyName, startFullscreen, mode = "stopwatch", onModeChange, projector: projectorProp, onProjectorChange, containerRef: externalContainerRef }: Props) {
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [projectorLocal, setProjectorLocal] = useState(false);
  const projector = projectorProp ?? projectorLocal;
  const toggleProjector = () => {
    const next = !projector;
    if (onProjectorChange) onProjectorChange(next);
    else setProjectorLocal(next);
  };
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [laps, setLaps] = useState<Lap[]>([]);

  const startTimeRef = useRef(0);
  const elapsedRef = useRef(0);
  const runningRef = useRef(false);
  const lastLapRef = useRef(0);
  const afRef = useRef(0);
  const internalRef = useRef<HTMLDivElement>(null);
  const containerRef = externalContainerRef ?? internalRef;

  const tick = useCallback(() => {
    if (!runningRef.current) return;
    const now = performance.now();
    setElapsed(elapsedRef.current + (now - startTimeRef.current));
    afRef.current = requestAnimationFrame(tick);
  }, []);

  const doToggle = useCallback(() => {
    if (!runningRef.current) {
      runningRef.current = true;
      startTimeRef.current = performance.now();
      setRunning(true);
      afRef.current = requestAnimationFrame(tick);
    } else {
      runningRef.current = false;
      elapsedRef.current += performance.now() - startTimeRef.current;
      cancelAnimationFrame(afRef.current);
      setRunning(false);
      setElapsed(elapsedRef.current);
    }
  }, [tick]);

  const doReset = useCallback(() => {
    runningRef.current = false;
    elapsedRef.current = 0;
    startTimeRef.current = 0;
    lastLapRef.current = 0;
    cancelAnimationFrame(afRef.current);
    setRunning(false);
    setElapsed(0);
    setLaps([]);
  }, []);

  const doLap = useCallback(() => {
    if (!runningRef.current) return;
    const now = performance.now();
    const total = elapsedRef.current + (now - startTimeRef.current);
    const split = total - lastLapRef.current;
    lastLapRef.current = total;
    setLaps((prev) => [{ n: prev.length + 1, split, total }, ...prev]);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.repeat) return;
      // Don't capture if user is typing in an input
      if ((e.target as HTMLElement)?.tagName === "INPUT" || (e.target as HTMLElement)?.tagName === "TEXTAREA") return;
      switch (e.code) {
        case "Space":
          e.preventDefault();
          doToggle();
          break;
        case "KeyR":
          doReset();
          break;
        case "KeyL":
          doLap();
          break;
        case "KeyP":
          toggleProjector();
          break;
        case "KeyF":
          toggleFullscreen();
          break;
        case "Escape":
          if (document.fullscreenElement) {
            document.exitFullscreen().catch(() => {});
          }
          break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [doToggle, doReset, doLap, toggleFullscreen]);

  // Track fullscreen state
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  // Auto-fullscreen on mount if requested
  useEffect(() => {
    if (startFullscreen && containerRef.current) {
      containerRef.current.requestFullscreen().catch(() => {});
    }
  }, [startFullscreen]);

  const t = formatTime(elapsed);
  const hasLaps = laps.length > 0;
  const isReady = !running && elapsed === 0;
  const isPaused = !running && elapsed > 0;

  // Best/worst lap detection
  let bestSplit = Infinity;
  let worstSplit = -Infinity;
  if (laps.length >= 2) {
    for (const l of laps) {
      if (l.split < bestSplit) bestSplit = l.split;
      if (l.split > worstSplit) worstSplit = l.split;
    }
  }

  return (
    <div
      ref={externalContainerRef ? undefined : internalRef}
      className={`${styles.root} ${projector ? styles.projector : ""} ${isFullscreen ? styles.fullscreen : ""}`}
    >
      {logoUrl && <img className={styles.watermark} src={logoUrl} alt="" draggable={false} />}

      {/* Top bar */}
      <div className={styles.topBar}>
        <div className={styles.brand}>
          {academyName && <span className={styles.brandName}>{academyName}</span>}
        </div>
        {onModeChange && (
          <div className={styles.modeToggle}>
            <button
              className={`${styles.modeBtn} ${mode === "timer" ? styles.modeBtnActive : ""}`}
              onClick={() => onModeChange("timer")}
              type="button"
            >
              타이머
            </button>
            <button
              className={`${styles.modeBtn} ${mode === "stopwatch" ? styles.modeBtnActive : ""}`}
              onClick={() => onModeChange("stopwatch")}
              type="button"
            >
              스톱워치
            </button>
          </div>
        )}
        <div className={styles.topRight}>
          <button
            className={`${styles.projToggle} ${projector ? styles.projActive : ""}`}
            onClick={() => toggleProjector()}
            type="button"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="7" width="20" height="15" rx="2" ry="2" />
              <polyline points="17 2 12 7 7 2" />
            </svg>
            <span>Projector</span>
            <div className={styles.toggleTrack}>
              <div className={styles.toggleThumb} />
            </div>
          </button>
          <button className={styles.fsBtn} onClick={toggleFullscreen} type="button" title="전체화면 (F)">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              {isFullscreen ? (
                <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
              ) : (
                <path d="M3 3h6v2H5v4H3V3zm12 0h6v6h-2V5h-4V3zM3 15h2v4h4v2H3v-6zm16 0h2v6h-6v-2h4v-4z" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className={styles.main}>
        {/* Status */}
        <div className={`${styles.status} ${running ? styles.statusRunning : ""} ${isPaused ? styles.statusPaused : ""}`}>
          <div className={styles.statusDot} />
          <span>{isReady ? "READY" : running ? "RUNNING" : "PAUSED"}</span>
        </div>

        {/* Time display */}
        <div className={`${styles.display} ${running ? styles.displayRunning : ""}`}>
          <span className={styles.digit}>{t.h}</span>
          <span className={styles.sep}>:</span>
          <span className={styles.digit}>{t.m}</span>
          <span className={styles.sep}>:</span>
          <span className={styles.digit}>{t.s}</span>
          <span className={styles.cs}>.{t.cs}</span>
        </div>

        {/* Controls */}
        <div className={styles.controls}>
          <button
            className={styles.btnSide}
            onClick={doReset}
            disabled={isReady}
            type="button"
          >
            Reset
          </button>
          <button
            className={`${styles.btnMain} ${running ? styles.btnStop : styles.btnStart}`}
            onClick={doToggle}
            type="button"
          >
            {running ? (
              <svg viewBox="0 0 24 24" fill="#fff">
                <rect x="5" y="3" width="4" height="18" rx="1" />
                <rect x="15" y="3" width="4" height="18" rx="1" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="#fff">
                <polygon points="6,3 20,12 6,21" />
              </svg>
            )}
          </button>
          <button
            className={styles.btnLap}
            onClick={doLap}
            disabled={!running}
            type="button"
          >
            Lap
          </button>
        </div>

        {/* Laps */}
        {hasLaps && (
          <div className={styles.laps}>
            {laps.map((l) => {
              let cls = styles.lap;
              if (laps.length >= 2) {
                if (l.split === bestSplit) cls += ` ${styles.lapBest}`;
                else if (l.split === worstSplit) cls += ` ${styles.lapWorst}`;
              }
              return (
                <div key={l.n} className={cls}>
                  <span className={styles.lapN}>LAP {pad(l.n)}</span>
                  <span className={styles.lapS}>{formatTimeStr(l.split)}</span>
                  <span className={styles.lapT}>{formatTimeStr(l.total)}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Keyboard hints */}
      <div className={styles.hints}>
        <span><kbd>Space</kbd> 시작/정지</span>
        <span><kbd>R</kbd> 초기화</span>
        <span><kbd>L</kbd> 랩</span>
        <span><kbd>P</kbd> 프로젝터</span>
        <span><kbd>F</kbd> 전체화면</span>
      </div>
    </div>
  );
}
