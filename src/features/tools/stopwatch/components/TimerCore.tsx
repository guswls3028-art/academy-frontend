// PATH: src/features/tools/stopwatch/components/TimerCore.tsx
// 프리미엄 카운트다운 타이머 — 시험 남은시간 표시, 빔프로젝터 모드 지원

import { useState, useRef, useCallback, useEffect } from "react";
import styles from "./TimerCore.module.css";

type Mode = "timer" | "stopwatch";

interface Props {
  logoUrl?: string;
  academyName?: string;
  startFullscreen?: boolean;
  mode?: Mode;
  onModeChange?: (mode: Mode) => void;
  projector?: boolean;
  onProjectorChange?: (v: boolean) => void;
  /** External fullscreen container ref — if provided, fullscreen targets this element */
  containerRef?: React.RefObject<HTMLDivElement | null>;
}

function pad(n: number, d = 2) {
  return String(n).padStart(d, "0");
}

function formatTime(ms: number) {
  const t = Math.max(0, Math.floor(ms));
  return {
    h: pad(Math.floor(t / 3600000)),
    m: pad(Math.floor((t % 3600000) / 60000)),
    s: pad(Math.floor((t % 60000) / 1000)),
    cs: pad(Math.floor((t % 1000) / 10)),
  };
}

type Phase = "setup" | "ready" | "running" | "paused" | "finished";

const PRESETS = [
  { label: "10분", ms: 10 * 60_000 },
  { label: "20분", ms: 20 * 60_000 },
  { label: "30분", ms: 30 * 60_000 },
  { label: "40분", ms: 40 * 60_000 },
  { label: "50분", ms: 50 * 60_000 },
  { label: "60분", ms: 60 * 60_000 },
  { label: "90분", ms: 90 * 60_000 },
  { label: "120분", ms: 120 * 60_000 },
];

const FONT_OPTIONS = [
  { label: "기본", value: "'JetBrains Mono', 'Consolas', monospace" },
  { label: "클래식", value: "'Georgia', 'Times New Roman', serif" },
  { label: "모던", value: "'SF Pro Display', 'Segoe UI', system-ui, sans-serif" },
  { label: "둥근", value: "'Pretendard', 'Apple SD Gothic Neo', sans-serif" },
];

/** Web Audio API beep for timer end */
function playAlarm() {
  try {
    const ctx = new AudioContext();
    const playBeep = (startTime: number, freq: number, dur: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.3, startTime);
      gain.gain.exponentialRampToValueAtTime(0.01, startTime + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(startTime);
      osc.stop(startTime + dur);
    };
    // Triple beep pattern
    const now = ctx.currentTime;
    playBeep(now, 880, 0.15);
    playBeep(now + 0.2, 880, 0.15);
    playBeep(now + 0.4, 1100, 0.3);
  } catch {
    // Audio not supported — silent fallback
  }
}

export default function TimerCore({ logoUrl, academyName, startFullscreen, mode = "timer", onModeChange, projector: projectorProp, onProjectorChange, containerRef: externalContainerRef }: Props) {
  const [phase, setPhase] = useState<Phase>("setup");
  const [remaining, setRemaining] = useState(0);
  const [totalSet, setTotalSet] = useState(0);
  const [fontFamily, setFontFamily] = useState(FONT_OPTIONS[0].value);
  const [projectorLocal, setProjectorLocal] = useState(false);
  const projector = projectorProp ?? projectorLocal;
  const toggleProjector = () => {
    const next = !projector;
    if (onProjectorChange) onProjectorChange(next);
    else setProjectorLocal(next);
  };
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Custom input
  const [inputMin, setInputMin] = useState("");
  const [inputSec, setInputSec] = useState("");

  const endTimeRef = useRef(0);
  const remainingRef = useRef(0);
  const runningRef = useRef(false);
  const afRef = useRef(0);
  const internalRef = useRef<HTMLDivElement>(null);
  const containerRef = externalContainerRef ?? internalRef;
  const alarmPlayedRef = useRef(false);
  const alarmIntervalRef = useRef<ReturnType<typeof setInterval>>();

  const tick = useCallback(() => {
    if (!runningRef.current) return;
    const now = performance.now();
    const left = endTimeRef.current - now;
    if (left <= 0) {
      runningRef.current = false;
      remainingRef.current = 0;
      setRemaining(0);
      setPhase("finished");
      if (!alarmPlayedRef.current) {
        alarmPlayedRef.current = true;
        playAlarm();
        // Repeat alarm every 3 seconds
        alarmIntervalRef.current = setInterval(playAlarm, 3000);
      }
      return;
    }
    remainingRef.current = left;
    setRemaining(left);
    afRef.current = requestAnimationFrame(tick);
  }, []);

  const startTimer = useCallback((ms: number) => {
    setTotalSet(ms);
    remainingRef.current = ms;
    setRemaining(ms);
    setPhase("ready");
  }, []);

  const doStart = useCallback(() => {
    runningRef.current = true;
    endTimeRef.current = performance.now() + remainingRef.current;
    alarmPlayedRef.current = false;
    setPhase("running");
    afRef.current = requestAnimationFrame(tick);
  }, [tick]);

  const doPause = useCallback(() => {
    runningRef.current = false;
    cancelAnimationFrame(afRef.current);
    remainingRef.current = endTimeRef.current - performance.now();
    if (remainingRef.current < 0) remainingRef.current = 0;
    setRemaining(remainingRef.current);
    setPhase("paused");
  }, []);

  const doToggle = useCallback(() => {
    if (phase === "ready" || phase === "paused") {
      doStart();
    } else if (phase === "running") {
      doPause();
    }
  }, [phase, doStart, doPause]);

  const doReset = useCallback(() => {
    runningRef.current = false;
    cancelAnimationFrame(afRef.current);
    if (alarmIntervalRef.current) {
      clearInterval(alarmIntervalRef.current);
      alarmIntervalRef.current = undefined;
    }
    remainingRef.current = 0;
    setRemaining(0);
    setTotalSet(0);
    setPhase("setup");
    setInputMin("");
    setInputSec("");
  }, []);

  const doAddMinute = useCallback(() => {
    if (phase === "running") {
      endTimeRef.current += 60_000;
      setTotalSet((prev) => prev + 60_000);
    } else if (phase === "paused") {
      remainingRef.current += 60_000;
      setRemaining(remainingRef.current);
      setTotalSet((prev) => prev + 60_000);
    } else if (phase === "finished") {
      // Add 1 min and restart
      if (alarmIntervalRef.current) {
        clearInterval(alarmIntervalRef.current);
        alarmIntervalRef.current = undefined;
      }
      remainingRef.current = 60_000;
      setRemaining(60_000);
      setTotalSet(60_000);
      runningRef.current = true;
      endTimeRef.current = performance.now() + 60_000;
      alarmPlayedRef.current = false;
      setPhase("running");
      afRef.current = requestAnimationFrame(tick);
    }
  }, [phase, tick]);

  const doDismiss = useCallback(() => {
    if (alarmIntervalRef.current) {
      clearInterval(alarmIntervalRef.current);
      alarmIntervalRef.current = undefined;
    }
    doReset();
  }, [doReset]);

  const handleCustomStart = useCallback(() => {
    const m = parseInt(inputMin || "0", 10);
    const s = parseInt(inputSec || "0", 10);
    const total = (m * 60 + s) * 1000;
    if (total > 0) startTimer(total);
  }, [inputMin, inputSec, startTimer]);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      // 전체 페이지 fullscreen — 윈도우 작업표시줄까지 가림
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") {
        if (e.code === "Enter") {
          e.preventDefault();
          if (phase === "setup") handleCustomStart();
        }
        return;
      }
      switch (e.code) {
        case "Space":
          e.preventDefault();
          if (phase === "finished") doDismiss();
          else doToggle();
          break;
        case "KeyR":
          doReset();
          break;
        case "KeyA":
          doAddMinute();
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
  }, [doToggle, doReset, doAddMinute, doDismiss, toggleFullscreen, phase, handleCustomStart]);

  // Track fullscreen state
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  // Auto-fullscreen on mount
  useEffect(() => {
    if (startFullscreen && containerRef.current) {
      containerRef.current.requestFullscreen().catch(() => {});
    }
  }, [startFullscreen]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cancelAnimationFrame(afRef.current);
      if (alarmIntervalRef.current) clearInterval(alarmIntervalRef.current);
    };
  }, []);

  const t = formatTime(remaining);
  const isWarning = phase === "running" && remaining > 0 && remaining <= 60_000;
  const totalMinSec = totalSet > 0
    ? `${Math.floor(totalSet / 60_000)}분 ${pad(Math.floor((totalSet % 60_000) / 1000))}초`
    : "";

  const statusText = (() => {
    switch (phase) {
      case "setup": return "SET TIME";
      case "ready": return "READY";
      case "running": return isWarning ? "LAST MINUTE" : "RUNNING";
      case "paused": return "PAUSED";
      case "finished": return "TIME UP";
    }
  })();

  const statusCls = (() => {
    switch (phase) {
      case "running": return isWarning ? styles.statusWarning : styles.statusRunning;
      case "paused": return styles.statusPaused;
      case "finished": return styles.statusFinished;
      default: return "";
    }
  })();

  const displayCls = [
    styles.display,
    phase === "running" && !isWarning ? styles.displayRunning : "",
    isWarning ? styles.displayWarning : "",
    phase === "finished" ? styles.displayFinished : "",
  ].filter(Boolean).join(" ");

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
        <div className={`${styles.status} ${statusCls}`}>
          <div className={styles.statusDot} />
          <span>{statusText}</span>
        </div>

        {phase === "setup" ? (
          /* ── Time Setup ── */
          <div className={styles.setup}>
            <span className={styles.setupLabel}>시험 시간을 선택하세요</span>
            <div className={styles.presets}>
              {PRESETS.map((p) => (
                <button
                  key={p.ms}
                  className={styles.presetBtn}
                  onClick={() => startTimer(p.ms)}
                  type="button"
                >
                  {p.label}
                </button>
              ))}
            </div>
            <div className={styles.customInput}>
              <input
                className={styles.timeInput}
                type="number"
                min="0"
                max="999"
                placeholder="분"
                value={inputMin}
                onChange={(e) => setInputMin(e.target.value)}
              />
              <span className={styles.timeInputLabel}>분</span>
              <span className={styles.timeInputSep}>:</span>
              <input
                className={styles.timeInput}
                type="number"
                min="0"
                max="59"
                placeholder="초"
                value={inputSec}
                onChange={(e) => setInputSec(e.target.value)}
              />
              <span className={styles.timeInputLabel}>초</span>
              <button
                className={styles.startSetBtn}
                onClick={handleCustomStart}
                disabled={!inputMin && !inputSec}
                type="button"
              >
                설정
              </button>
            </div>
            {/* Font selector */}
            <div className={styles.fontSelector}>
              <span className={styles.fontSelectorLabel}>글꼴</span>
              <div className={styles.fontOptions}>
                {FONT_OPTIONS.map((f) => (
                  <button
                    key={f.label}
                    className={`${styles.fontBtn} ${fontFamily === f.value ? styles.fontBtnActive : ""}`}
                    onClick={() => setFontFamily(f.value)}
                    type="button"
                    style={{ fontFamily: f.value }}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Time display */}
            <div className={displayCls} style={{ fontFamily }}>
              <span className={styles.digit}>{t.h}</span>
              <span className={styles.sep}>:</span>
              <span className={styles.digit}>{t.m}</span>
              <span className={styles.sep}>:</span>
              <span className={styles.digit}>{t.s}</span>
              {phase !== "finished" && <span className={styles.cs}>.{t.cs}</span>}
            </div>

            {/* Total time label */}
            {totalMinSec && phase !== "finished" && (
              <span className={styles.totalLabel}>설정: {totalMinSec}</span>
            )}

            {/* Controls */}
            <div className={styles.controls}>
              <button
                className={styles.btnSide}
                onClick={doReset}
                type="button"
              >
                초기화
              </button>

              {phase === "finished" ? (
                <button
                  className={`${styles.btnMain} ${styles.btnStop}`}
                  onClick={doDismiss}
                  type="button"
                  title="확인"
                >
                  <svg viewBox="0 0 24 24" fill="#fff">
                    <path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z" />
                  </svg>
                </button>
              ) : (
                <button
                  className={`${styles.btnMain} ${phase === "running" ? styles.btnStop : styles.btnStart}`}
                  onClick={doToggle}
                  type="button"
                >
                  {phase === "running" ? (
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
              )}

              <button
                className={styles.btnAdd}
                onClick={doAddMinute}
                type="button"
              >
                +1분
              </button>
            </div>
          </>
        )}
      </div>

      {/* Keyboard hints */}
      <div className={styles.hints}>
        <span><kbd>Space</kbd> 시작/정지</span>
        <span><kbd>R</kbd> 초기화</span>
        <span><kbd>A</kbd> +1분</span>
        <span><kbd>P</kbd> 프로젝터</span>
        <span><kbd>F</kbd> 전체화면</span>
      </div>
    </div>
  );
}
