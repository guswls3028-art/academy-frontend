// PATH: src/app_teacher/domains/tools/pages/StopwatchPage.tsx
// 모바일 스톱워치 — 내장 타이머 + 안전한 PWA 설치 안내
import { useEffect, useRef, useState } from "react";
import { useA2HS } from "@/shared/pwa/useA2HS";
import { cx } from "@/shared/utils/cx";
import { useNavigate } from "react-router";
import { SectionTitle, BackButton } from "@teacher/shared/ui/Card";
import { teacherToast } from "@teacher/shared/ui/teacherToast";
import styles from "./StopwatchPage.module.css";

const TIMER_TICK_MS = 30;

function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms));
  const h = Math.floor(total / 3_600_000);
  const m = Math.floor((total % 3_600_000) / 60_000);
  const s = Math.floor((total % 60_000) / 1000);
  const cs = Math.floor((total % 1000) / 10);
  const hh = h > 0 ? `${String(h).padStart(2, "0")}:` : "";
  return `${hh}${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
}

type Lap = { index: number; total: number; delta: number };

export default function StopwatchPage() {
  const navigate = useNavigate();
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [laps, setLaps] = useState<Lap[]>([]);
  const [installing, setInstalling] = useState(false);
  const { canInstall, isInstalled, promptInstall } = useA2HS();
  const lastStartRef = useRef<number>(0);
  const baseRef = useRef<number>(0);

  useEffect(() => {
    if (!running) return;

    const tick = () => {
      setElapsed(baseRef.current + (performance.now() - lastStartRef.current));
    };
    tick();
    const intervalId = window.setInterval(tick, TIMER_TICK_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [running]);

  const start = () => {
    if (running) return;
    lastStartRef.current = performance.now();
    setRunning(true);
  };
  const stop = () => {
    if (!running) return;
    baseRef.current += performance.now() - lastStartRef.current;
    setElapsed(baseRef.current);
    setRunning(false);
  };
  const reset = () => {
    baseRef.current = 0;
    lastStartRef.current = performance.now();
    setElapsed(0);
    setLaps([]);
  };
  const lap = () => {
    const total = running ? baseRef.current + (performance.now() - lastStartRef.current) : baseRef.current;
    setLaps((prevLaps) => {
      const prevTotal = prevLaps.length > 0 ? prevLaps[prevLaps.length - 1].total : 0;
      return [...prevLaps, { index: prevLaps.length + 1, total, delta: total - prevTotal }];
    });
  };

  const handleInstall = async () => {
    if (!canInstall) return;

    setInstalling(true);
    try {
      if (await promptInstall()) teacherToast.success("타이머 앱을 설치했습니다.");
    } finally {
      setInstalling(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <BackButton onClick={() => navigate("/workspace/mobile/tools")} />
        <h1 className={styles.title}>타이머</h1>
      </div>

      {/* 큰 시간 표시 */}
      <section className={styles.timeCard}>
        <div
          className={cx(styles.timeDisplay, running && styles.timeDisplayRunning)}
          data-testid="mobile-stopwatch-display"
        >
          {formatElapsed(elapsed)}
        </div>
        <div className={styles.statusLabel}>
          {running ? "진행 중" : elapsed > 0 ? "일시정지" : "대기"}
        </div>
      </section>

      {/* Controls */}
      <div className={styles.controls}>
        {!running ? (
          <button
            type="button"
            onClick={start}
            className={cx(styles.controlButton, styles.startButton)}
          >
            {elapsed > 0 ? "재개" : "시작"}
          </button>
        ) : (
          <button
            type="button"
            onClick={stop}
            className={cx(styles.controlButton, styles.stopButton)}
          >
            정지
          </button>
        )}
        <button
          type="button"
          onClick={running ? lap : reset}
          disabled={!running && elapsed === 0}
          className={cx(styles.controlButton, styles.secondaryButton)}
        >
          {running ? "랩" : "리셋"}
        </button>
      </div>

      {/* Laps */}
      {laps.length > 0 && (
        <>
          <SectionTitle>랩 ({laps.length})</SectionTitle>
          <section className={styles.lapCard}>
            {[...laps].reverse().map((l) => (
              <div
                key={l.index}
                className={styles.lapRow}
              >
                <span className={styles.lapLabel}>랩 {l.index}</span>
                <div className={styles.lapTimes}>
                  <div className={styles.lapDelta}>
                    {formatElapsed(l.delta)}
                  </div>
                  <div className={styles.lapTotal}>
                    합계 {formatElapsed(l.total)}
                  </div>
                </div>
              </div>
            ))}
          </section>
        </>
      )}

      <SectionTitle>PC에서 안전하게 사용</SectionTitle>
      <section className={styles.pcCard}>
        <div className={styles.pcDescription}>
          이 화면이 공식 타이머입니다. Windows에서는 브라우저 앱으로 설치해 시작 메뉴와 작업 표시줄에서 바로 열 수 있습니다.
        </div>
        {canInstall || isInstalled ? (
          <button
            type="button"
            onClick={() => void handleInstall()}
            className={styles.downloadButton}
            disabled={installing || isInstalled}
          >
            {isInstalled ? "앱으로 실행 중" : installing ? "설치 확인 중..." : "이 기기에 앱으로 설치"}
          </button>
        ) : (
          <p className={styles.securityNote}>
            Edge·Chrome 메뉴에서 <b>앱 → 이 사이트를 앱으로 설치</b>를 선택하세요.
          </p>
        )}
        <p className={styles.securityNote}>
          Smart App Control을 끄거나 기존 English_Timer 실행 파일을 열 필요가 없습니다.
        </p>
      </section>
    </div>
  );
}
